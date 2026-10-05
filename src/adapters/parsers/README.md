# Parser adapter

Future input/output: `ParserPort.parse(bytes, mime)` returns canonical `NormalizedDocument[]`. Owns file-format decoding and extraction metadata. It does not persist source data or invent citations; no parser is bound here.
