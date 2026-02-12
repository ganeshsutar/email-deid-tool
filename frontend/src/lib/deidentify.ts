import type { EmailSection, WorkspaceAnnotation } from "@/types/models";
import { SectionType } from "@/types/enums";

/**
 * Replace annotated spans with [tag] placeholders, processing from end to start
 * so that earlier offsets remain valid. Mirrors backend _deidentify() logic.
 */
export function deidentify(
  rawContent: string,
  annotations: WorkspaceAnnotation[],
): string {
  const sorted = [...annotations].sort(
    (a, b) => b.startOffset - a.startOffset,
  );
  let content = rawContent;
  for (const ann of sorted) {
    const tag = ann.tag || ann.className;
    // tag already includes brackets like [email_1], use as-is
    const replacement = tag.startsWith("[") && tag.endsWith("]") ? tag : `[${tag}]`;
    content =
      content.slice(0, ann.startOffset) +
      replacement +
      content.slice(ann.endOffset);
  }
  return content;
}

/**
 * Apply deidentification per section, returning new sections with replaced content.
 */
export function deidentifySections(
  sections: EmailSection[],
  annotations: WorkspaceAnnotation[],
): EmailSection[] {
  const annsBySection = new Map<number, WorkspaceAnnotation[]>();
  for (const ann of annotations) {
    const list = annsBySection.get(ann.sectionIndex) ?? [];
    list.push(ann);
    annsBySection.set(ann.sectionIndex, list);
  }

  return sections.map((section) => {
    const sectionAnns = annsBySection.get(section.index) ?? [];
    if (sectionAnns.length === 0) return section;
    return {
      ...section,
      content: deidentify(section.content, sectionAnns),
    };
  });
}

/**
 * Build a synthetic de-identified .eml string from sections + annotations.
 * The result can be fed directly to EmailViewer / eml-parser for structured display.
 */
export function buildDeidentifiedEml(
  sections: EmailSection[],
  annotations: WorkspaceAnnotation[],
): string {
  const deidentified = deidentifySections(sections, annotations);

  const headerSection = deidentified.find((s) => s.type === SectionType.HEADERS);
  const textPlain = deidentified.find((s) => s.type === SectionType.TEXT_PLAIN);
  const textHtml = deidentified.find((s) => s.type === SectionType.TEXT_HTML);

  // Strip Content-Type, Content-Transfer-Encoding, and MIME-Version from original headers
  // (we'll add our own to match the reconstructed body structure)
  const strippedHeaders = headerSection
    ? headerSection.content.replace(
        /^(Content-Type|Content-Transfer-Encoding|MIME-Version):.*(?:\r?\n[ \t]+.*)*/gim,
        "",
      ).replace(/\n{2,}/g, "\n").trim()
    : "";

  if (textPlain && textHtml) {
    const boundary = "----deidentified-boundary";
    return [
      strippedHeaders,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      `Content-Type: text/plain; charset="utf-8"`,
      "",
      textPlain.content,
      `--${boundary}`,
      `Content-Type: text/html; charset="utf-8"`,
      "",
      textHtml.content,
      `--${boundary}--`,
      "",
    ].join("\n");
  }

  if (textHtml) {
    return [
      strippedHeaders,
      `Content-Type: text/html; charset="utf-8"`,
      "",
      textHtml.content,
    ].join("\n");
  }

  // text/plain only or no body
  return [
    strippedHeaders,
    `Content-Type: text/plain; charset="utf-8"`,
    "",
    textPlain?.content ?? "",
  ].join("\n");
}
