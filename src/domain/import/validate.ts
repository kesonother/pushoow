import { cellAt } from "@/domain/import/csv";
import { requiredFields } from "@/domain/import/detect";
import type { ImportError, ImportField, ImportKind, ImportMapping } from "@/domain/import/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL.test(value.trim().toLowerCase());
}

export function parseImportDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = Date.parse(trimmed);
  if (!Number.isNaN(iso)) return new Date(iso);
  return null;
}

export function mappedValue(headers: string[], row: string[], mapping: ImportMapping, field: ImportField): string {
  return cellAt(headers, row, mapping[field]);
}

export function validateRows(input: {
  kind: ImportKind;
  headers: string[];
  rows: string[][];
  mapping: ImportMapping;
  ticketNames?: string[];
}): ImportError[] {
  const errors: ImportError[] = [];
  const seen = new Set<string>();
  const tickets = new Set((input.ticketNames ?? []).map((item) => item.trim().toLowerCase()));
  const required = requiredFields(input.kind);

  input.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const email = mappedValue(input.headers, row, input.mapping, "email").trim().toLowerCase();
    for (const field of required) {
      const value = mappedValue(input.headers, row, input.mapping, field);
      if (!value) {
        errors.push({
          row: rowNumber,
          email: email || null,
          field,
          code: "missing_required",
          message: `Missing ${field}`,
        });
      }
    }
    if (required.includes("email") && email) {
      if (!isValidEmail(email)) {
        errors.push({
          row: rowNumber,
          email,
          field: "email",
          code: "invalid_email",
          message: "Invalid email",
        });
      } else if (seen.has(email)) {
        errors.push({
          row: rowNumber,
          email,
          field: "email",
          code: "duplicate_email",
          message: "Duplicate email in file",
        });
      } else {
        seen.add(email);
      }
    }
    for (const field of ["startsAt", "endsAt", "createdAt"] as const) {
      const value = mappedValue(input.headers, row, input.mapping, field);
      if (value && !parseImportDate(value)) {
        errors.push({
          row: rowNumber,
          email: email || null,
          field,
          code: "invalid_date",
          message: `Invalid date: ${value}`,
        });
      }
    }
    const ticket = mappedValue(input.headers, row, input.mapping, "ticketType");
    if (
      input.kind === "guests" &&
      ticket &&
      input.ticketNames !== undefined &&
      !tickets.has(ticket.toLowerCase())
    ) {
      errors.push({
        row: rowNumber,
        email: email || null,
        field: "ticketType",
        code: "invalid_ticket_type",
        message: `Unknown ticket type: ${ticket}`,
      });
    }
  });
  return errors;
}
