import os
import logging
from fontTools.ttLib import TTFont

logger = logging.getLogger(__name__)

def get_font_family_name(font_path):
    """
    Extracts the font family name (NameID 1) from a font file.
    Returns None if extraction fails.
    """
    try:
        font = TTFont(font_path)
        # Try to get the family name (ID 1)
        # We prefer Windows English (3, 1, 0x409)
        name_record = font['name'].getName(1, 3, 1, 0x409)
        if name_record:
            return name_record.toUnicode()
        
        # Fallback to any ID 1
        for record in font['name'].names:
            if record.nameID == 1:
                return record.toUnicode()
                
        return None
    except Exception as e:
        logger.warning(f"Failed to parse font {font_path}: {e}")
        return None

def detect_language(font):
    """
    Detects the primary language/script of the font using OS/2 table code pages.
    Returns: 'Korean', 'Japanese', 'Chinese', 'English', or 'Other'
    """
    try:
        os2 = font['OS/2']
        
        # Check CodePageRange1 bits
        # Bit 20: 949 Korean Wansung
        # Bit 21: 1361 Korean Johab
        if os2.ulCodePageRange1 & (1 << 20) or os2.ulCodePageRange1 & (1 << 21):
            return "Korean"
            
        # Bit 17: 932 JIS/Japan
        if os2.ulCodePageRange1 & (1 << 17):
            return "Japanese"
            
        # Bit 18: 936 Chinese: Simplified
        # Bit 20: 950 Chinese: Traditional (Note: Bit 20 is shared with Korean in some docs, but usually distinct in usage or checked via other means. 
        # However, standard spec says Bit 20 is "Korean Wansung" and Bit 18 is "Simplified Chinese". 
        # Traditional Chinese is often Bit 20 in older docs or separate. 
        # Let's rely on Bit 18 for Simplified and maybe check name for Traditional if needed.)
        # Actually, standard:
        # Bit 17: JIS/Japan
        # Bit 18: Chinese: Simplified
        # Bit 19: Korean Wansung (Wait, MS spec says Bit 19 is Korean Wansung? No, let's check standard)
        # MS OpenType Spec:
        # Bit 17: 932 JIS/Japan
        # Bit 18: 936 Chinese: Simplified
        # Bit 19: 949 Korean Wansung
        # Bit 20: 950 Chinese: Traditional
        # Bit 21: 1361 Korean Johab
        
        # Let's re-verify bits:
        # 17: JIS (Japanese)
        # 18: Chinese Simplified
        # 19: Korean Wansung
        # 20: Chinese Traditional
        # 21: Korean Johab
        
        if os2.ulCodePageRange1 & (1 << 19) or os2.ulCodePageRange1 & (1 << 21):
            return "Korean"
            
        if os2.ulCodePageRange1 & (1 << 17):
            return "Japanese"
            
        if os2.ulCodePageRange1 & (1 << 18) or os2.ulCodePageRange1 & (1 << 20):
            return "Chinese"
            
        # Default to English/Latin if Latin 1 (Bit 0) is set and no CJK
        if os2.ulCodePageRange1 & (1 << 0):
            return "English"
            
        return "Other"
        
    except Exception:
        return "Other"

def scan_fonts(directory):
    """
    Scans a directory for font files and returns a dictionary of fonts grouped by language.
    Format: { "Korean": ["FontA"], "English": ["FontB"], ... }
    """
    fonts_by_lang = {
        "Korean": [],
        "English": [],
        "Japanese": [],
        "Chinese": [],
        "Other": []
    }
    
    if not os.path.exists(directory):
        return fonts_by_lang
        
    seen_fonts = set()
        
    failed_fonts = []
    
    for filename in os.listdir(directory):
        # Strict filtering: Only TTF and OTF (User requested strict filtering)
        if filename.lower().endswith(('.ttf', '.otf')):
            path = os.path.join(directory, filename)
            try:
                font = TTFont(path)
                family_name = None
                
                # Get Family Name
                name_record = font['name'].getName(1, 3, 1, 0x409)
                if name_record:
                    family_name = name_record.toUnicode()
                else:
                    for record in font['name'].names:
                        if record.nameID == 1:
                            family_name = record.toUnicode()
                            break
                
                if not family_name:
                    family_name = os.path.splitext(filename)[0]
                
                if family_name in seen_fonts:
                    continue
                    
                seen_fonts.add(family_name)
                
                # Detect Language
                lang = detect_language(font)
                
                # Special Case: Check for Korean characters in name if detection failed or returned English (common for some Korean fonts)
                # Many Korean fonts identify as English code page but have Korean names or are obviously Korean
                if lang == "English":
                    # Heuristic: Check if family name contains Korean characters
                    if any(ord(c) >= 0xAC00 and ord(c) <= 0xD7A3 for c in family_name):
                        lang = "Korean"
                    # Heuristic: Common Korean font names in English
                    elif any(k in family_name.lower() for k in ['nanum', 'gothic', 'myeongjo', 'batang', 'dotum', 'gulim', 'gungsuh']):
                        # Only upgrade to Korean if it really seems like a Korean font
                        # "Gothic" is generic, so be careful. "Nanum" is safe.
                        if 'nanum' in family_name.lower() or 'batang' in family_name.lower() or 'dotum' in family_name.lower() or 'gulim' in family_name.lower():
                             lang = "Korean"
                
                if lang in fonts_by_lang:
                    fonts_by_lang[lang].append(family_name)
                else:
                    fonts_by_lang["Other"].append(family_name)
                    
            except Exception as e:
                # Collect failure instead of logging immediately
                failed_fonts.append(f"{filename} ({str(e)})")
                # Fallback
                fonts_by_lang["Other"].append(os.path.splitext(filename)[0])
    
    # Log summary of failures
    if failed_fonts:
        logger.warning(f"Failed to parse {len(failed_fonts)} fonts. First few errors: {', '.join(failed_fonts[:3])}...")
                
    # Sort lists
    for key in fonts_by_lang:
        fonts_by_lang[key].sort()
        
    return fonts_by_lang
