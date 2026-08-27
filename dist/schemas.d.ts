import { z } from 'zod';

declare const Envelope: z.ZodObject<{
    meta: z.ZodObject<{
        type: z.ZodEnum<["merchant-statement", "bank-csv", "esb-meter"]>;
        source: z.ZodString;
        parsedAt: z.ZodString;
        confidence: z.ZodDefault<z.ZodEnum<["high", "medium", "low"]>>;
        parserVersion: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        source: string;
        type: "merchant-statement" | "bank-csv" | "esb-meter";
        parsedAt: string;
        confidence: "high" | "medium" | "low";
        parserVersion: string;
    }, {
        source: string;
        type: "merchant-statement" | "bank-csv" | "esb-meter";
        parsedAt: string;
        parserVersion: string;
        confidence?: "high" | "medium" | "low" | undefined;
    }>;
    payload: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    meta: {
        source: string;
        type: "merchant-statement" | "bank-csv" | "esb-meter";
        parsedAt: string;
        confidence: "high" | "medium" | "low";
        parserVersion: string;
    };
    payload?: unknown;
}, {
    meta: {
        source: string;
        type: "merchant-statement" | "bank-csv" | "esb-meter";
        parsedAt: string;
        parserVersion: string;
        confidence?: "high" | "medium" | "low" | undefined;
    };
    payload?: unknown;
}>;
type Envelope = z.infer<typeof Envelope>;

declare const MerchantStatementSchema: z.ZodObject<{
    meta: z.ZodObject<{
        provider: z.ZodEnum<["elavon", "worldpay", "aib-merchant-services", "global-payments", "unknown"]>;
        statementPeriodStart: z.ZodString;
        statementPeriodEnd: z.ZodString;
        merchantId: z.ZodString;
        merchantName: z.ZodString;
        currency: z.ZodDefault<z.ZodLiteral<"EUR">>;
        generatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        provider: "unknown" | "elavon" | "worldpay" | "aib-merchant-services" | "global-payments";
        statementPeriodStart: string;
        statementPeriodEnd: string;
        merchantId: string;
        merchantName: string;
        currency: "EUR";
        generatedAt: string;
    }, {
        provider: "unknown" | "elavon" | "worldpay" | "aib-merchant-services" | "global-payments";
        statementPeriodStart: string;
        statementPeriodEnd: string;
        merchantId: string;
        merchantName: string;
        generatedAt: string;
        currency?: "EUR" | undefined;
    }>;
    summary: z.ZodObject<{
        totalVolume: z.ZodNumber;
        totalCount: z.ZodNumber;
        totalInterchange: z.ZodNumber;
        totalSchemeFees: z.ZodNumber;
        totalAcquirerFees: z.ZodNumber;
        totalFees: z.ZodNumber;
        netSettlement: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalVolume: number;
        totalCount: number;
        totalInterchange: number;
        totalSchemeFees: number;
        totalAcquirerFees: number;
        totalFees: number;
        netSettlement: number;
    }, {
        totalVolume: number;
        totalCount: number;
        totalInterchange: number;
        totalSchemeFees: number;
        totalAcquirerFees: number;
        totalFees: number;
        netSettlement: number;
    }>;
    lineItems: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        cardType: z.ZodEnum<["visa", "mastercard", "amex", "visa-debit", "mastercard-debit", "unknown"]>;
        transactionType: z.ZodEnum<["sale", "refund", "chargeback", "reversal", "other"]>;
        volume: z.ZodNumber;
        count: z.ZodNumber;
        rate: z.ZodNumber;
        interchangeFee: z.ZodNumber;
        schemeFee: z.ZodNumber;
        acquirerFee: z.ZodNumber;
        totalFee: z.ZodNumber;
        netAmount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        date: string;
        cardType: "unknown" | "visa" | "mastercard" | "amex" | "visa-debit" | "mastercard-debit";
        transactionType: "sale" | "refund" | "chargeback" | "reversal" | "other";
        volume: number;
        count: number;
        rate: number;
        interchangeFee: number;
        schemeFee: number;
        acquirerFee: number;
        totalFee: number;
        netAmount: number;
    }, {
        date: string;
        cardType: "unknown" | "visa" | "mastercard" | "amex" | "visa-debit" | "mastercard-debit";
        transactionType: "sale" | "refund" | "chargeback" | "reversal" | "other";
        volume: number;
        count: number;
        rate: number;
        interchangeFee: number;
        schemeFee: number;
        acquirerFee: number;
        totalFee: number;
        netAmount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    meta: {
        provider: "unknown" | "elavon" | "worldpay" | "aib-merchant-services" | "global-payments";
        statementPeriodStart: string;
        statementPeriodEnd: string;
        merchantId: string;
        merchantName: string;
        currency: "EUR";
        generatedAt: string;
    };
    summary: {
        totalVolume: number;
        totalCount: number;
        totalInterchange: number;
        totalSchemeFees: number;
        totalAcquirerFees: number;
        totalFees: number;
        netSettlement: number;
    };
    lineItems: {
        date: string;
        cardType: "unknown" | "visa" | "mastercard" | "amex" | "visa-debit" | "mastercard-debit";
        transactionType: "sale" | "refund" | "chargeback" | "reversal" | "other";
        volume: number;
        count: number;
        rate: number;
        interchangeFee: number;
        schemeFee: number;
        acquirerFee: number;
        totalFee: number;
        netAmount: number;
    }[];
}, {
    meta: {
        provider: "unknown" | "elavon" | "worldpay" | "aib-merchant-services" | "global-payments";
        statementPeriodStart: string;
        statementPeriodEnd: string;
        merchantId: string;
        merchantName: string;
        generatedAt: string;
        currency?: "EUR" | undefined;
    };
    summary: {
        totalVolume: number;
        totalCount: number;
        totalInterchange: number;
        totalSchemeFees: number;
        totalAcquirerFees: number;
        totalFees: number;
        netSettlement: number;
    };
    lineItems: {
        date: string;
        cardType: "unknown" | "visa" | "mastercard" | "amex" | "visa-debit" | "mastercard-debit";
        transactionType: "sale" | "refund" | "chargeback" | "reversal" | "other";
        volume: number;
        count: number;
        rate: number;
        interchangeFee: number;
        schemeFee: number;
        acquirerFee: number;
        totalFee: number;
        netAmount: number;
    }[];
}>;
type MerchantStatement = z.infer<typeof MerchantStatementSchema>;

declare const BankCsvSchema: z.ZodObject<{
    account: z.ZodOptional<z.ZodString>;
    currency: z.ZodDefault<z.ZodString>;
    rows: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        description: z.ZodString;
        amount: z.ZodNumber;
        balance: z.ZodOptional<z.ZodNumber>;
        category: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        date: string;
        amount: number;
        description: string;
        balance?: number | undefined;
        category?: string | undefined;
    }, {
        date: string;
        amount: number;
        description: string;
        balance?: number | undefined;
        category?: string | undefined;
    }>, "many">;
    summary: z.ZodObject<{
        totalIn: z.ZodNumber;
        totalOut: z.ZodNumber;
        net: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalIn: number;
        totalOut: number;
        net: number;
    }, {
        totalIn: number;
        totalOut: number;
        net: number;
    }>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    summary: {
        totalIn: number;
        totalOut: number;
        net: number;
    };
    rows: {
        date: string;
        amount: number;
        description: string;
        balance?: number | undefined;
        category?: string | undefined;
    }[];
    account?: string | undefined;
}, {
    summary: {
        totalIn: number;
        totalOut: number;
        net: number;
    };
    rows: {
        date: string;
        amount: number;
        description: string;
        balance?: number | undefined;
        category?: string | undefined;
    }[];
    currency?: string | undefined;
    account?: string | undefined;
}>;
type BankStatement = z.infer<typeof BankCsvSchema>;

declare const ESBMeterSchema: z.ZodObject<{
    mprn: z.ZodOptional<z.ZodString>;
    readings: z.ZodArray<z.ZodObject<{
        timestamp: z.ZodString;
        import_kwh: z.ZodNumber;
        export_kwh: z.ZodDefault<z.ZodNumber>;
        tariff: z.ZodOptional<z.ZodEnum<["day", "night", "peak"]>>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        import_kwh: number;
        export_kwh: number;
        tariff?: "day" | "night" | "peak" | undefined;
    }, {
        timestamp: string;
        import_kwh: number;
        export_kwh?: number | undefined;
        tariff?: "day" | "night" | "peak" | undefined;
    }>, "many">;
    summary: z.ZodObject<{
        totalImport_kwh: z.ZodNumber;
        totalExport_kwh: z.ZodNumber;
        days: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalImport_kwh: number;
        totalExport_kwh: number;
        days: number;
    }, {
        totalImport_kwh: number;
        totalExport_kwh: number;
        days: number;
    }>;
}, "strip", z.ZodTypeAny, {
    summary: {
        totalImport_kwh: number;
        totalExport_kwh: number;
        days: number;
    };
    readings: {
        timestamp: string;
        import_kwh: number;
        export_kwh: number;
        tariff?: "day" | "night" | "peak" | undefined;
    }[];
    mprn?: string | undefined;
}, {
    summary: {
        totalImport_kwh: number;
        totalExport_kwh: number;
        days: number;
    };
    readings: {
        timestamp: string;
        import_kwh: number;
        export_kwh?: number | undefined;
        tariff?: "day" | "night" | "peak" | undefined;
    }[];
    mprn?: string | undefined;
}>;
type ESBReading = z.infer<typeof ESBMeterSchema>;

export { BankCsvSchema, type BankStatement, ESBMeterSchema, type ESBReading, Envelope, type MerchantStatement, MerchantStatementSchema };
