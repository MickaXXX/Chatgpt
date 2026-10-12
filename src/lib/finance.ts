/**
 * Simulaciones en UF y CLP. Los supuestos son editables, no cotizaciones.
 * Las tasas y porcentajes de entrada se expresan entre 0 y 100.
 */
export type Profile = {
  salary: number;
  extraIncome: number;
  extraMonths: number;
  savings: number;
  monthlySavings: number;
  emergencyReserve: number;
  recognizeExtraIncome: boolean;
};

export type Assumptions = {
  uf: number;
  ufDate: string;
  priceUf: number;
  downPaymentPct: number;
  annualRatePct: number;
  rateKind: 'nominal' | 'effective';
  years: number;
  deliveryMonths: number;
  purchaseCosts: number;
  insurance: number;
  rent: number;
  vacancyPct: number;
  managementPct: number;
  maintenancePct: number;
  commonExpenses: number;
  ownerCommonPct: number;
  propertyTaxMonthly: number;
  otherMonthlyCosts: number;
  adr: number;
  occupancyPct: number;
  platformPct: number;
  shortManagementPct: number;
  costPerNight: number;
  shortFixedCosts: number;
  furnishing: number;
  annualUfGrowthPct: number;
  /** Provisión ilustrativa sobre ingresos, no determinación del IVA ni renta. */
  shortTaxPct?: number;
};

export type MortgageMonth = {
  month: number;
  interestUf: number;
  principalUf: number;
  balanceUf: number;
  paymentUf: number;
};

export type RentalResult = {
  /** Ingreso mensual efectivo después de la vacancia. */
  gross: number;
  /** Ingreso operativo antes de dividendo y seguros hipotecarios. */
  net: number;
  /** Flujo mensual después de dividendo y seguros hipotecarios. */
  flow: number;
  /** Rentabilidad operativa anual / precio de compra (antes del crédito). */
  netYieldPct: number;
  management: number;
  maintenance: number;
  commonExpenses: number;
  operatingCosts: number;
};

export type ShortRentalResult = RentalResult & {
  /** Se usan 30 noches por mes en esta simulación. */
  occupiedNights: number;
  platform: number;
  taxProvision: number;
  variableCosts: number;
  /** Puede superar 100. Infinity indica margen por noche insuficiente. */
  breakEvenOccupancyPct: number;
  /** Desembolso inicial adicional, no gasto mensual ni parte del pie. */
  furnishing: number;
  cashNeeded: number;
  gap: number;
};

export type Scenario = {
  name: string;
  rent: number;
  occupancyPct: number;
  uf: number;
  annualRatePct: number;
  paymentClp: number;
  traditionalFlow: number;
  shortFlow: number;
};

export type FinancialResult = {
  priceClp: number;
  downPayment: number;
  downPaymentUf: number;
  loanUf: number;
  loanClp: number;
  monthlyRate: number;
  paymentUf: number;
  paymentClp: number;
  totalDebtPayment: number;
  recognizedIncome: number;
  /** Porcentaje de ingreso reconocido usado por dividendo y seguros. */
  incomeRatio: number;
  /** Referencia de evaluación de 25%, no requisito de un banco concreto. */
  estimatedRequiredIncome: number;
  debtLimit: number;
  availableSavings: number;
  reservedSavings: number;
  savingsAtDelivery: number;
  cashNeeded: number;
  gap: number;
  fundingSurplus: number;
  /** Con entrega inmediata es el saldo que se necesita pagar hoy. */
  monthlyNeeded: number;
  extraAnnualIncome: number;
  projectedUf: number;
  projectedCashNeeded: number;
  projectedGap: number;
  traditional: RentalResult;
  short: ShortRentalResult;
  mortgageSchedule: MortgageMonth[];
  scenarios: Scenario[];
};

export const defaultProfile: Profile = {
  // La versión pública no incluye el perfil financiero de su propietario.
  salary: 0,
  extraIncome: 0,
  extraMonths: 6,
  savings: 0,
  monthlySavings: 0,
  // Supuesto editable: el usuario no informó un fondo de emergencia.
  emergencyReserve: 2_000_000,
  recognizeExtraIncome: false,
};

export const defaultAssumptions: Assumptions = {
  // Referencia manual ilustrativa. No se presenta como UF oficial vigente.
  uf: 41_000,
  ufDate: '',
  priceUf: 2_500,
  downPaymentPct: 20,
  annualRatePct: 5,
  rateKind: 'nominal',
  years: 30,
  deliveryMonths: 36,
  purchaseCosts: 2_000_000,
  insurance: 25_000,
  rent: 480_000,
  vacancyPct: 8,
  managementPct: 8,
  maintenancePct: 5,
  commonExpenses: 80_000,
  ownerCommonPct: 0,
  propertyTaxMonthly: 15_000,
  otherMonthlyCosts: 10_000,
  adr: 42_000,
  occupancyPct: 60,
  platformPct: 15,
  shortManagementPct: 18,
  costPerNight: 4_000,
  shortFixedCosts: 60_000,
  furnishing: 4_000_000,
  annualUfGrowthPct: 3,
  // Provisión editable; el impuesto efectivo requiere tasación y régimen.
  shortTaxPct: 19,
};

/** Una referencia explícita, no una evaluación crediticia. */
export const INCOME_REFERENCE_RATIO = 0.25;
export const NIGHTS_PER_MONTH = 30;

function finiteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} debe ser un número finito.`);
  }
}

function nonnegative(value: number, name: string): void {
  finiteNumber(value, name);
  if (value < 0) throw new RangeError(`${name} no puede ser negativo.`);
  if (value > 1e12) throw new RangeError(`${name} supera el rango de esta calculadora.`);
}

function percentage(value: number, name: string): void {
  finiteNumber(value, name);
  if (value < 0 || value > 100) {
    throw new RangeError(`${name} debe estar entre 0 y 100.`);
  }
}

/** Rechaza entradas inválidas en vez de producir cifras plausibles incorrectas. */
export function validateInputs(profile: Profile, assumptions: Assumptions): void {
  const profileValues: Array<[number, string]> = [
    [profile.salary, 'Renta líquida'],
    [profile.extraIncome, 'Honorarios'],
    [profile.savings, 'Ahorro actual'],
    [profile.monthlySavings, 'Ahorro mensual'],
    [profile.emergencyReserve, 'Reserva de emergencia'],
  ];
  profileValues.forEach(([value, name]) => nonnegative(value, name));
  if (!Number.isInteger(profile.extraMonths) || profile.extraMonths < 0 || profile.extraMonths > 12) {
    throw new RangeError('Los meses de honorarios deben ser un entero entre 0 y 12.');
  }
  const costs: Array<[number, string]> = [
    [assumptions.purchaseCosts, 'Gastos de compra'],
    [assumptions.insurance, 'Seguros'],
    [assumptions.rent, 'Arriendo tradicional'],
    [assumptions.commonExpenses, 'Gastos comunes'],
    [assumptions.propertyTaxMonthly, 'Contribuciones mensuales'],
    [assumptions.otherMonthlyCosts, 'Otros gastos mensuales'],
    [assumptions.adr, 'Tarifa por noche'],
    [assumptions.costPerNight, 'Costo por noche'],
    [assumptions.shortFixedCosts, 'Gastos fijos de renta corta'],
    [assumptions.furnishing, 'Amoblado'],
  ];
  costs.forEach(([value, name]) => nonnegative(value, name));
  const percentages: Array<[number, string]> = [
    [assumptions.downPaymentPct, 'Pie'],
    [assumptions.vacancyPct, 'Vacancia'],
    [assumptions.managementPct, 'Administración tradicional'],
    [assumptions.maintenancePct, 'Mantención'],
    [assumptions.ownerCommonPct, 'Gastos comunes a cargo del propietario'],
    [assumptions.occupancyPct, 'Ocupación'],
    [assumptions.platformPct, 'Comisión de plataforma'],
    [assumptions.shortManagementPct, 'Administración de renta corta'],
    [assumptions.shortTaxPct ?? defaultAssumptions.shortTaxPct!, 'Provisión tributaria de renta corta'],
  ];
  percentages.forEach(([value, name]) => percentage(value, name));
  finiteNumber(assumptions.uf, 'UF');
  finiteNumber(assumptions.priceUf, 'Precio UF');
  if (assumptions.uf <= 0 || assumptions.priceUf <= 0) {
    throw new RangeError('La UF y el precio deben ser mayores que cero.');
  }
  if (assumptions.uf > 1_000_000 || assumptions.priceUf > 100_000) {
    throw new RangeError('La UF o el precio superan el rango de esta calculadora.');
  }
  nonnegative(assumptions.annualRatePct, 'Tasa anual');
  if (assumptions.annualRatePct > 100) {
    throw new RangeError('La tasa anual supera el rango de esta calculadora (100%).');
  }
  if (assumptions.rateKind !== 'nominal' && assumptions.rateKind !== 'effective') {
    throw new RangeError('El tipo de tasa debe ser nominal o efectiva.');
  }
  finiteNumber(assumptions.years, 'Plazo');
  if (assumptions.years <= 0 || assumptions.years > 100 || !Number.isInteger(assumptions.years * 12)) {
    throw new RangeError('El plazo debe ser positivo, de hasta 100 años y corresponder a meses completos.');
  }
  if (!Number.isInteger(assumptions.deliveryMonths) || assumptions.deliveryMonths < 0 || assumptions.deliveryMonths > 1_200) {
    throw new RangeError('Los meses hasta la entrega deben ser un entero entre 0 y 1200.');
  }
  finiteNumber(assumptions.annualUfGrowthPct, 'Variación anual de UF');
  if (assumptions.annualUfGrowthPct <= -100 || assumptions.annualUfGrowthPct > 100) {
    throw new RangeError('La variación anual de UF debe ser mayor a −100% y de hasta 100%.');
  }
}

export function monthlyInterestRate(annualRatePct: number, rateKind: Assumptions['rateKind']): number {
  nonnegative(annualRatePct, 'Tasa anual');
  const annualRate = annualRatePct / 100;
  return rateKind === 'effective'
    ? Math.expm1(Math.log1p(annualRate) / 12)
    : annualRate / 12;
}

/** Cuota constante en UF mediante amortización francesa. No incluye seguros. */
export function mortgagePayment(loanUf: number, monthlyRate: number, months: number): number {
  nonnegative(loanUf, 'Crédito UF');
  nonnegative(monthlyRate, 'Tasa mensual');
  if (!Number.isInteger(months) || months <= 0) {
    throw new RangeError('El número de cuotas debe ser un entero positivo.');
  }
  if (loanUf === 0) return 0;
  if (monthlyRate === 0) return loanUf / months;
  // expm1 evita pérdida de precisión en tasas próximas a cero.
  const denominator = -Math.expm1(-months * Math.log1p(monthlyRate));
  return loanUf * monthlyRate / denominator;
}

export function amortizationSchedule(loanUf: number, monthlyRate: number, months: number): MortgageMonth[] {
  const paymentUf = mortgagePayment(loanUf, monthlyRate, months);
  let balanceUf = loanUf;
  return Array.from({ length: months }, (_, index) => {
    const interestUf = balanceUf * monthlyRate;
    // La última cuota liquida cualquier residuo de precisión numérica.
    const principalUf = index === months - 1
      ? balanceUf
      : Math.min(balanceUf, Math.max(0, paymentUf - interestUf));
    const installment = principalUf + interestUf;
    balanceUf = Math.max(0, balanceUf - principalUf);
    return {
      month: index + 1,
      interestUf,
      principalUf,
      balanceUf,
      paymentUf: installment,
    };
  });
}

function traditionalRental(assumptions: Assumptions, totalDebtPayment: number, priceClp: number): RentalResult {
  const vacancy = assumptions.vacancyPct / 100;
  const gross = assumptions.rent * (1 - vacancy);
  const management = gross * assumptions.managementPct / 100;
  const maintenance = gross * assumptions.maintenancePct / 100;
  // Durante vacancia el propietario paga todos los gastos comunes.
  const commonExpenses = assumptions.commonExpenses
    * ((1 - vacancy) * assumptions.ownerCommonPct / 100 + vacancy);
  const operatingCosts = management + maintenance + commonExpenses
    + assumptions.propertyTaxMonthly + assumptions.otherMonthlyCosts;
  const net = gross - operatingCosts;
  return {
    gross,
    net,
    flow: net - totalDebtPayment,
    netYieldPct: net * 12 / priceClp * 100,
    management,
    maintenance,
    commonExpenses,
    operatingCosts,
  };
}

function shortRental(
  assumptions: Assumptions,
  totalDebtPayment: number,
  priceClp: number,
  cashNeeded: number,
  /** Ahorro total menos reserva objetivo; negativo si falta financiarla. */
  fundingBalance: number,
): ShortRentalResult {
  const occupiedNights = NIGHTS_PER_MONTH * assumptions.occupancyPct / 100;
  const gross = assumptions.adr * occupiedNights;
  // Cada comisión se calcula sobre ingreso bruto, sin descontar otra antes.
  const platform = gross * assumptions.platformPct / 100;
  const management = gross * assumptions.shortManagementPct / 100;
  const maintenance = gross * assumptions.maintenancePct / 100;
  const variableCosts = occupiedNights * assumptions.costPerNight;
  const taxPct = assumptions.shortTaxPct ?? defaultAssumptions.shortTaxPct!;
  const taxProvision = gross * taxPct / 100;
  const fixedCosts = assumptions.shortFixedCosts + assumptions.commonExpenses
    + assumptions.propertyTaxMonthly + assumptions.otherMonthlyCosts;
  const operatingCosts = platform + management + maintenance + taxProvision + variableCosts + fixedCosts;
  const net = gross - operatingCosts;
  const contributionPerNight = assumptions.adr
    * (1 - (assumptions.platformPct + assumptions.shortManagementPct + assumptions.maintenancePct + taxPct) / 100)
    - assumptions.costPerNight;
  const costsToCover = fixedCosts + totalDebtPayment;
  const breakEvenOccupancyPct = contributionPerNight > 0
    ? costsToCover / (NIGHTS_PER_MONTH * contributionPerNight) * 100
    : costsToCover === 0 && contributionPerNight === 0 ? 0 : Number.POSITIVE_INFINITY;
  const shortCashNeeded = cashNeeded + assumptions.furnishing;
  return {
    gross,
    net,
    flow: net - totalDebtPayment,
    netYieldPct: net * 12 / (priceClp + assumptions.furnishing) * 100,
    management,
    maintenance,
    commonExpenses: assumptions.commonExpenses,
    operatingCosts,
    occupiedNights,
    platform,
    taxProvision,
    variableCosts,
    breakEvenOccupancyPct,
    furnishing: assumptions.furnishing,
    cashNeeded: shortCashNeeded,
    gap: Math.max(0, shortCashNeeded - fundingBalance),
  };
}

export function calculate(profile: Profile, assumptions: Assumptions): FinancialResult {
  validateInputs(profile, assumptions);
  const priceClp = assumptions.priceUf * assumptions.uf;
  const downPaymentUf = assumptions.priceUf * assumptions.downPaymentPct / 100;
  const downPayment = downPaymentUf * assumptions.uf;
  const loanUf = assumptions.priceUf - downPaymentUf;
  const monthlyRate = monthlyInterestRate(assumptions.annualRatePct, assumptions.rateKind);
  const months = assumptions.years * 12;
  const paymentUf = mortgagePayment(loanUf, monthlyRate, months);
  const paymentClp = paymentUf * assumptions.uf;
  const totalDebtPayment = paymentClp + assumptions.insurance;
  const extraAnnualIncome = profile.extraIncome * profile.extraMonths;
  const recognizedIncome = profile.salary + (profile.recognizeExtraIncome ? extraAnnualIncome / 12 : 0);
  const incomeRatio = recognizedIncome > 0
    ? totalDebtPayment / recognizedIncome * 100
    : totalDebtPayment > 0 ? Number.POSITIVE_INFINITY : 0;
  const availableSavings = Math.max(0, profile.savings - profile.emergencyReserve);
  const reservedSavings = Math.min(profile.savings, profile.emergencyReserve);
  // El ahorro mensual declarado ya resume el presupuesto del usuario.
  // No sumamos los honorarios automáticamente, para evitar contarlos dos veces.
  const totalSavingsAtDelivery = profile.savings + profile.monthlySavings * assumptions.deliveryMonths;
  const fundingBalance = totalSavingsAtDelivery - profile.emergencyReserve;
  const savingsAtDelivery = Math.max(0, fundingBalance);
  const cashNeeded = downPayment + assumptions.purchaseCosts;
  // Si la reserva todavía no está financiada, los primeros aportes la completan.
  const remainingCash = Math.max(0, cashNeeded + profile.emergencyReserve - profile.savings);
  const monthlyNeeded = assumptions.deliveryMonths > 0
    ? remainingCash / assumptions.deliveryMonths
    : remainingCash;
  const projectedUf = assumptions.uf
    * Math.pow(1 + assumptions.annualUfGrowthPct / 100, assumptions.deliveryMonths / 12);
  const projectedCashNeeded = downPaymentUf * projectedUf + assumptions.purchaseCosts;
  const traditional = traditionalRental(assumptions, totalDebtPayment, priceClp);
  const short = shortRental(assumptions, totalDebtPayment, priceClp, cashNeeded, fundingBalance);
  const scenarioInputs: Array<{ name: string; values: Assumptions }> = [
    { name: 'Base · UF de referencia', values: assumptions },
    {
      name: 'Conservador · renta −10%, ocupación −10 pp, vacancia +5 pp',
      values: {
        ...assumptions,
        rent: assumptions.rent * 0.9,
        occupancyPct: Math.max(0, assumptions.occupancyPct - 10),
        vacancyPct: Math.min(100, assumptions.vacancyPct + 5),
      },
    },
    {
      name: 'Estrés · renta −20%, ocupación −20 pp, tasa +2 pp, UF a entrega',
      values: {
        ...assumptions,
        uf: projectedUf,
        rent: assumptions.rent * 0.8,
        occupancyPct: Math.max(0, assumptions.occupancyPct - 20),
        vacancyPct: Math.max(25, assumptions.vacancyPct),
        annualRatePct: assumptions.annualRatePct + 2,
      },
    },
    { name: 'Solo UF proyectada a la entrega', values: { ...assumptions, uf: projectedUf } },
  ];
  const scenarios = scenarioInputs.map(({ name, values }): Scenario => {
    const scenarioPayment = mortgagePayment(
      loanUf,
      monthlyInterestRate(values.annualRatePct, values.rateKind),
      months,
    ) * values.uf;
    const debt = scenarioPayment + values.insurance;
    const scenarioPrice = values.priceUf * values.uf;
    return {
      name,
      rent: values.rent,
      occupancyPct: values.occupancyPct,
      uf: values.uf,
      annualRatePct: values.annualRatePct,
      paymentClp: scenarioPayment,
      traditionalFlow: traditionalRental(values, debt, scenarioPrice).flow,
      shortFlow: shortRental(values, debt, scenarioPrice, cashNeeded, fundingBalance).flow,
    };
  });
  return {
    priceClp,
    downPayment,
    downPaymentUf,
    loanUf,
    loanClp: loanUf * assumptions.uf,
    monthlyRate,
    paymentUf,
    paymentClp,
    totalDebtPayment,
    recognizedIncome,
    incomeRatio,
    estimatedRequiredIncome: totalDebtPayment / INCOME_REFERENCE_RATIO,
    debtLimit: recognizedIncome * INCOME_REFERENCE_RATIO,
    availableSavings,
    reservedSavings,
    savingsAtDelivery,
    cashNeeded,
    gap: Math.max(0, cashNeeded - fundingBalance),
    fundingSurplus: Math.max(0, fundingBalance - cashNeeded),
    monthlyNeeded,
    extraAnnualIncome,
    projectedUf,
    projectedCashNeeded,
    projectedGap: Math.max(0, projectedCashNeeded - fundingBalance),
    traditional,
    short,
    mortgageSchedule: amortizationSchedule(loanUf, monthlyRate, months),
    scenarios,
  };
}
