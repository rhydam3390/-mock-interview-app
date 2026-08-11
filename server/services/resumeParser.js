// Extracts plain text from an uploaded resume file (PDF or Word .docx).
// Used by the resume-based interview feature so users can upload a file
// instead of pasting text manually.

const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

// Extracts text from a file buffer based on its mimetype/extension.
// Returns { text } or throws an Error with a user-facing message.
const extractResumeText = async (file) => {
  if (!file || !file.buffer) {
    const err = new Error("No file was uploaded.");
    err.status = 400;
    throw err;
  }

  if (file.size > MAX_FILE_BYTES) {
    const err = new Error("File is too large — please upload a resume under 5MB.");
    err.status = 400;
    throw err;
  }

  const name = (file.originalname || "").toLowerCase();
  const isPdf = file.mimetype === "application/pdf" || name.endsWith(".pdf");
  const isDocx =
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx");
  const isDoc = name.endsWith(".doc") && !isDocx;

  if (isDoc) {
    const err = new Error("Old .doc files aren't supported — please save your resume as .docx or .pdf and try again.");
    err.status = 400;
    throw err;
  }

  if (!isPdf && !isDocx) {
    const err = new Error("Unsupported file type — please upload a PDF or Word (.docx) file.");
    err.status = 400;
    throw err;
  }

  try {
    if (isPdf) {
      const data = await pdfParse(file.buffer);
      return { text: data.text.trim() };
    }

    // .docx
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return { text: result.value.trim() };
  } catch (parseError) {
    console.error("Resume parse error:", parseError.message);
    const err = new Error("Couldn't read that file — it may be corrupted, image-based, or password-protected. Try pasting the text instead.");
    err.status = 400;
    throw err;
  }
};

module.exports = { extractResumeText };