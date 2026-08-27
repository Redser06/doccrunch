import { parse as csvParseSync } from 'csv-parse/sync';
import { ParserPlugin, ParseContext } from '../core/types.js';
import { BankStatement, BankStatementSchema, BankRow } from '../schemas/bank-csv.js';

export const bankCsvParser: ParserPlugin<BankStatement> = {
  name: 'bank-csv',
  version: 'bank-csv@0.1.0',
  detect(content: string): boolean {
    const firstLine = content.split(/\r?\n/)[0] || '';
    const normalized = firstLine.toLowerCase().replace(/\s+/g, '');
    return (
      normalized.includes('date') &&
      normalized.includes('description') &&
      normalized.includes('amount')
    );
  },
  parse(content: string, _context: ParseContext): BankStatement {
    const records: Array<Record<string, string>> = csvParseSync(content, {
      columns: (header: string[]) =>
        header.map((col) => col.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')),
      skip_empty_lines: true,
      trim: true,
    });

    const rows: BankRow[] = [];
    let totalIn = 0;
    let totalOut = 0;

    for (const record of records) {
      const date = record['date'] || record['timestamp'] || record['transactiondate'] || '';
      const description =
        record['description'] || record['narrative'] || record['memo'] || record['details'] || '';
      const rawAmount = record['amount'] || record['value'] || '0';
      const amount = Number(parseFloat(rawAmount.replace(/,/g, '')).toFixed(2));

      const rawBalance = record['balance'] || record['runningbalance'];
      const balance =
        rawBalance !== undefined && rawBalance !== ''
          ? Number(parseFloat(rawBalance.replace(/,/g, '')).toFixed(2))
          : undefined;

      const category = record['category'] || undefined;

      const row: BankRow = {
        date,
        description,
        amount,
      };

      if (balance !== undefined && !isNaN(balance)) {
        row.balance = balance;
      }
      if (category) {
        row.category = category;
      }

      rows.push(row);

      if (amount > 0) {
        totalIn += amount;
      } else if (amount < 0) {
        totalOut += Math.abs(amount);
      }
    }

    const roundedTotalIn = Number(totalIn.toFixed(2));
    const roundedTotalOut = Number(totalOut.toFixed(2));
    const net = Number((roundedTotalIn - roundedTotalOut).toFixed(2));

    const result: BankStatement = {
      currency: 'EUR',
      rows,
      summary: {
        totalIn: roundedTotalIn,
        totalOut: roundedTotalOut,
        net,
      },
    };

    return BankStatementSchema.parse(result);
  },
  schema: BankStatementSchema,
};
