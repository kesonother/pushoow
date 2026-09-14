import { ValidationError } from "@/domain/errors";
import { IMPORT_MAX_BYTES } from "@/domain/import/types";

export type ImportUploadInput = {
  kind: string;
  calendarId: string | null;
  eventId: string | null;
  filename: string;
  csv: string;
};

function assertCsvFile(filename: string, type: string) {
  const name = filename.toLowerCase();
  const allowedType = type === "" || type === "text/csv" || type === "application/vnd.ms-excel" || type === "text/plain";
  if (!name.endsWith(".csv") && !allowedType) {
    throw new ValidationError("Only CSV files are accepted");
  }
}

export async function readImportUpload(request: Request): Promise<ImportUploadInput> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ValidationError("A CSV file is required");
    if (file.size > IMPORT_MAX_BYTES) throw new ValidationError("The CSV file is too large");
    const filename = file.name || "import.csv";
    assertCsvFile(filename, file.type);
    return {
      kind: String(form.get("kind") ?? ""),
      calendarId: String(form.get("calendarId") ?? "") || null,
      eventId: String(form.get("eventId") ?? "") || null,
      filename,
      csv: await file.text(),
    };
  }

  let body: {
    kind?: string;
    calendarId?: string;
    eventId?: string;
    filename?: string;
    csv?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
  if (typeof body.csv !== "string") throw new ValidationError("A CSV payload is required");
  if (Buffer.byteLength(body.csv, "utf8") > IMPORT_MAX_BYTES) {
    throw new ValidationError("The CSV file is too large");
  }
  return {
    kind: body.kind ?? "",
    calendarId: body.calendarId || null,
    eventId: body.eventId || null,
    filename: body.filename || "import.csv",
    csv: body.csv,
  };
}
