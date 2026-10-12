import { describe, expect, it } from 'vitest';
import {
  amortizationSchedule,
  calculate,
  defaultAssumptions,
  defaultProfile,
  monthlyInterestRate,
  mortgagePayment,
} from './finance';

// Datos ficticios para probar el cálculo; no representan al propietario.
const fixtureProfile = {
  ...defaultProfile,
  salary: 2_000_000,
  extraIncome: 200_000,
  savings: 4_000_000,
  monthlySavings: 300_000,
};

describe('crédito hipotecario en UF', () => {
  it('amortiza todo el capital y separa intereses de capital', () => {
    const result = calculate(defaultProfile, defaultAssumptions);
    expect(result.loanUf).toBe(2_000);
    expect(result.paymentUf).toBeCloseTo(10.7364324602, 8);
    expect(result.mortgageSchedule).toHaveLength(360);
    expect(result.mortgageSchedule[0].interestUf).toBeCloseTo(2_000 * 0.05 / 12, 10);
    expect(result.mortgageSchedule.at(-1)?.balanceUf).toBe(0);
    expect(result.mortgageSchedule.reduce((total, row) => total + row.principalUf, 0)).toBeCloseTo(2_000, 8);
    for (const row of result.mortgageSchedule) {
      expect(row.interestUf + row.principalUf).toBeCloseTo(row.paymentUf, 10);
      expect(row.balanceUf).toBeGreaterThanOrEqual(0);
    }
  });

  it('soporta tasa cero sin división por cero', () => {
    const payment = mortgagePayment(1_200, 0, 120);
    const schedule = amortizationSchedule(1_200, 0, 120);
    expect(payment).toBe(10);
    expect(schedule.every(row => row.interestUf === 0 && row.principalUf === 10)).toBe(true);
    expect(schedule.at(-1)?.balanceUf).toBe(0);
  });

  it('convierte correctamente tasas nominales y efectivas', () => {
    const effective = monthlyInterestRate(5, 'effective');
    const nominal = monthlyInterestRate(5, 'nominal');
    expect(Math.pow(1 + effective, 12) - 1).toBeCloseTo(0.05, 12);
    expect(nominal).toBeCloseTo(0.05 / 12, 12);
    expect(effective).toBeLessThan(nominal);
    const equivalentNominalPct = effective * 12 * 100;
    expect(mortgagePayment(2_000, monthlyInterestRate(equivalentNominalPct, 'nominal'), 360))
      .toBeCloseTo(mortgagePayment(2_000, effective, 360), 10);
  });

  it('no genera deuda cuando el pie cubre el precio completo', () => {
    const result = calculate(defaultProfile, { ...defaultAssumptions, downPaymentPct: 100, insurance: 0 });
    expect(result.loanUf).toBe(0);
    expect(result.totalDebtPayment).toBe(0);
    expect(result.mortgageSchedule.every(row => row.balanceUf === 0)).toBe(true);
  });
});

describe('capacidad de ahorro e ingreso estacional', () => {
  it('cuenta seis pagos de honorarios por año y solo los reconoce cuando se solicita', () => {
    const base = calculate(fixtureProfile, defaultAssumptions);
    const recognized = calculate({ ...fixtureProfile, recognizeExtraIncome: true }, defaultAssumptions);
    expect(base.extraAnnualIncome).toBe(1_200_000);
    expect(base.recognizedIncome).toBe(2_000_000);
    expect(recognized.recognizedIncome).toBe(2_100_000);
    expect(recognized.savingsAtDelivery).toBe(base.savingsAtDelivery);
    expect(recognized.incomeRatio).toBeLessThan(base.incomeRatio);
  });

  it('protege la reserva y calcula el saldo del pie con gastos de compra', () => {
    const result = calculate(fixtureProfile, defaultAssumptions);
    expect(result.reservedSavings).toBe(2_000_000);
    expect(result.availableSavings).toBe(2_000_000);
    expect(result.savingsAtDelivery).toBe(12_800_000);
    expect(result.cashNeeded).toBe(22_500_000);
    expect(result.gap).toBe(9_700_000);
    expect(result.monthlyNeeded).toBeCloseTo(20_500_000 / 36, 8);
    expect(result.estimatedRequiredIncome).toBe(result.totalDebtPayment / 0.25);
  });

  it('no convierte una reserva mayor que el ahorro en saldo negativo', () => {
    const result = calculate({ ...defaultProfile, emergencyReserve: 7_000_000 }, defaultAssumptions);
    expect(result.availableSavings).toBe(0);
    expect(result.reservedSavings).toBe(defaultProfile.savings);
  });

  it('financia la reserva antes de considerar ahorro disponible en un horizonte corto', () => {
    const profile = { ...fixtureProfile, savings: 500_000, monthlySavings: 100_000, emergencyReserve: 2_000_000 };
    const result = calculate(profile, { ...defaultAssumptions, deliveryMonths: 6 });
    expect(result.availableSavings).toBe(0);
    expect(result.savingsAtDelivery).toBe(0);
    // Al horizonte aún faltan 900 mil para completar la reserva.
    expect(result.gap).toBe(result.cashNeeded + 900_000);
    expect(result.projectedGap).toBe(result.projectedCashNeeded + 900_000);
    expect(result.short.gap).toBe(result.short.cashNeeded + 900_000);
    expect(result.monthlyNeeded).toBe((result.cashNeeded + 1_500_000) / 6);
    expect(result.fundingSurplus).toBe(0);
  });

  it('solo libera el excedente después de completar la reserva en un horizonte largo', () => {
    const profile = { ...fixtureProfile, savings: 500_000, monthlySavings: 100_000, emergencyReserve: 2_000_000 };
    const result = calculate(profile, { ...defaultAssumptions, deliveryMonths: 24 });
    expect(result.availableSavings).toBe(0);
    expect(result.savingsAtDelivery).toBe(900_000);
    expect(result.gap).toBe(result.cashNeeded - 900_000);
    expect(result.short.gap).toBe(result.short.cashNeeded - 900_000);
    expect(result.monthlyNeeded).toBe((result.cashNeeded + 1_500_000) / 24);
  });

  it('incluye el déficit de reserva en el saldo inmediato incluso sin pie ni gastos', () => {
    const profile = { ...fixtureProfile, savings: 500_000, emergencyReserve: 2_000_000 };
    const result = calculate(profile, {
      ...defaultAssumptions,
      deliveryMonths: 0,
      downPaymentPct: 0,
      purchaseCosts: 0,
      furnishing: 0,
    });
    expect(result.cashNeeded).toBe(0);
    expect(result.savingsAtDelivery).toBe(0);
    expect(result.gap).toBe(1_500_000);
    expect(result.projectedGap).toBe(1_500_000);
    expect(result.short.gap).toBe(1_500_000);
    expect(result.monthlyNeeded).toBe(1_500_000);
    expect(result.fundingSurplus).toBe(0);
  });

  it('distingue el saldo inmediato del aporte mensual y nunca da un faltante negativo', () => {
    const immediate = calculate(defaultProfile, { ...defaultAssumptions, deliveryMonths: 0 });
    expect(immediate.monthlyNeeded).toBe(immediate.gap);
    const funded = calculate({ ...defaultProfile, savings: 50_000_000 }, defaultAssumptions);
    expect(funded.gap).toBe(0);
    expect(funded.monthlyNeeded).toBe(0);
    expect(funded.fundingSurplus).toBeGreaterThan(0);
  });
});

describe('arriendo tradicional y renta corta', () => {
  it('el dueño paga gastos comunes durante vacancia aunque el arrendatario los pague ocupado', () => {
    const result = calculate(defaultProfile, {
      ...defaultAssumptions,
      rent: 500_000,
      vacancyPct: 20,
      managementPct: 0,
      maintenancePct: 0,
      commonExpenses: 100_000,
      ownerCommonPct: 0,
      propertyTaxMonthly: 0,
      otherMonthlyCosts: 0,
    });
    expect(result.traditional.gross).toBe(400_000);
    expect(result.traditional.commonExpenses).toBe(20_000);
    expect(result.traditional.net).toBe(380_000);
    expect(result.traditional.flow).toBeCloseTo(380_000 - result.totalDebtPayment, 8);
  });

  it('mantiene gastos comunes completos con vacancia total', () => {
    const result = calculate(defaultProfile, { ...defaultAssumptions, vacancyPct: 100, ownerCommonPct: 0 });
    expect(result.traditional.gross).toBe(0);
    expect(result.traditional.commonExpenses).toBe(defaultAssumptions.commonExpenses);
    expect(result.traditional.flow).toBeLessThan(-result.totalDebtPayment);
  });

  it('incluye comisiones, costos por noche, gastos comunes y deuda en la renta corta', () => {
    const result = calculate(defaultProfile, {
      ...defaultAssumptions,
      adr: 50_000,
      occupancyPct: 50,
      platformPct: 10,
      shortManagementPct: 20,
      maintenancePct: 5,
      costPerNight: 4_000,
      shortFixedCosts: 30_000,
      shortTaxPct: 19,
      commonExpenses: 80_000,
      propertyTaxMonthly: 10_000,
      otherMonthlyCosts: 5_000,
    });
    expect(result.short.occupiedNights).toBe(15);
    expect(result.short.gross).toBe(750_000);
    expect(result.short.platform).toBe(75_000);
    expect(result.short.management).toBe(150_000);
    expect(result.short.maintenance).toBe(37_500);
    expect(result.short.variableCosts).toBe(60_000);
    expect(result.short.commonExpenses).toBe(80_000);
    expect(result.short.taxProvision).toBe(142_500);
    expect(result.short.net).toBe(160_000);
    expect(result.short.flow).toBeCloseTo(160_000 - result.totalDebtPayment, 8);
    expect(result.short.cashNeeded).toBe(result.cashNeeded + defaultAssumptions.furnishing);
    expect(result.short.gap).toBe(result.gap + defaultAssumptions.furnishing);
  });

  it('la ocupación de equilibrio produce flujo cero y puede superar 100%', () => {
    const assumptions = { ...defaultAssumptions, downPaymentPct: 100, insurance: 0 };
    const result = calculate(defaultProfile, assumptions);
    expect(result.short.breakEvenOccupancyPct).toBeGreaterThan(0);
    expect(result.short.breakEvenOccupancyPct).toBeLessThan(100);
    const atBreakEven = calculate(defaultProfile, { ...assumptions, occupancyPct: result.short.breakEvenOccupancyPct });
    expect(atBreakEven.short.flow).toBeCloseTo(0, 7);
    const impossible = calculate(defaultProfile, { ...defaultAssumptions, adr: 10_000 });
    expect(impossible.short.breakEvenOccupancyPct).toBeGreaterThan(100);
  });

  it('informa cuando cada noche pierde dinero antes de cubrir gastos fijos', () => {
    const result = calculate(defaultProfile, { ...defaultAssumptions, adr: 1_000, costPerNight: 5_000 });
    expect(result.short.breakEvenOccupancyPct).toBe(Number.POSITIVE_INFINITY);
    expect(result.short.flow).toBeLessThan(0);
  });
});

describe('riesgos y entradas inválidas', () => {
  it('separa el precio de UF actual del costo proyectado del pie y del dividendo', () => {
    const result = calculate(defaultProfile, defaultAssumptions);
    expect(result.projectedUf).toBeCloseTo(41_000 * 1.03 ** 3, 8);
    expect(result.projectedCashNeeded).toBeGreaterThan(result.cashNeeded);
    expect(result.projectedGap).toBeGreaterThan(result.gap);
    expect(result.scenarios[0].paymentClp).toBeCloseTo(result.paymentClp, 8);
    expect(result.scenarios[1].paymentClp).toBeCloseTo(result.paymentClp, 8);
    expect(result.scenarios[1].traditionalFlow).toBeLessThan(result.traditional.flow);
    expect(result.scenarios[1].shortFlow).toBeLessThan(result.short.flow);
    expect(result.scenarios[3].paymentClp).toBeGreaterThan(result.paymentClp);
    expect(result.scenarios[2].traditionalFlow).toBeLessThan(result.scenarios[1].traditionalFlow);
    expect(result.scenarios[2].shortFlow).toBeLessThan(result.scenarios[1].shortFlow);
  });

  it('rechaza porcentajes, períodos y valores no finitos que darían resultados engañosos', () => {
    expect(() => calculate(defaultProfile, { ...defaultAssumptions, occupancyPct: 101 })).toThrow(RangeError);
    expect(() => calculate(defaultProfile, { ...defaultAssumptions, uf: Number.NaN })).toThrow(RangeError);
    expect(() => calculate(defaultProfile, { ...defaultAssumptions, deliveryMonths: -1 })).toThrow(RangeError);
    expect(() => calculate({ ...defaultProfile, extraMonths: 13 }, defaultAssumptions)).toThrow(RangeError);
    expect(() => calculate(defaultProfile, { ...defaultAssumptions, annualUfGrowthPct: -100 })).toThrow(RangeError);
  });
});
