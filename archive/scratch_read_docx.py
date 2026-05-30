import zipfile
import xml.etree.ElementTree as ET

def extract_text_from_docx(docx_path):
    # docx is a zip file, we can open it and extract word/document.xml
    with zipfile.ZipFile(docx_path, 'r') as docx:
        xml_content = docx.read('word/document.xml')
        
    root = ET.fromstring(xml_content)
    
    # namespaces
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    
    paragraphs = []
    # Find all paragraph elements
    for p in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
        p_text = []
        # Find all text elements in this paragraph
        for t in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
            if t.text:
                p_text.append(t.text)
        paragraphs.append("".join(p_text))
        
    return "\n".join(paragraphs)

if __name__ == "__main__":
    import sys
    text = extract_text_from_docx("Oteka TD - 001 (6).docx")
    
    # Let's search for the word 'streak' or 'friend' in the extracted text
    lines = text.split("\n")
    print(f"Total paragraphs extracted: {len(lines)}")
    print("\n--- Search Results for 'streak' or 'friend' ---")
    for i, line in enumerate(lines):
        if 'streak' in line.lower() or 'friend' in line.lower():
            print(f"Para {i}: {line}\n")
            
    # Also write the full text to a scratch file so we can view it
    with open("scratch_docx_text.txt", "w", encoding="utf-8") as f:
        f.write(text)
    print("Full text written to scratch_docx_text.txt")
