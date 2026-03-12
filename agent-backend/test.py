from docling.document_converter import DocumentConverter

source = "docling.pdf"  # document per local path or URL
converter = DocumentConverter()
result = converter.convert(source)

# Print results to console
print(result.document.export_to_markdown())