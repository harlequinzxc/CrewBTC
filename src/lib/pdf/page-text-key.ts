/**
 * Identity of one page's extracted text: file, source version, and page number.
 *
 * Two explicit functions rather than one with an optional argument: a key that
 * sometimes includes the version and sometimes does not invites a caller to build one
 * shape and look up the other, which fails silently by finding nothing.
 *
 * `pageKey` is what the UI uses (the version is why a re-uploaded file cannot serve
 * the previous file's blocks). `exportKey` is the shape the writer is given, already
 * resolved to whichever blocks were extracted for that page.
 */
export const pageKey = (fileName: string, pageNumber: number, version: number): string =>
  `${fileName}#${version}#${pageNumber}`

export const exportKey = (fileName: string, pageNumber: number): string =>
  `${fileName}#${pageNumber}`
