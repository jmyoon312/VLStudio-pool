import re

_REJECT_WORDS = frozenset([
    "india", "indian", "hindi", "bollywood", "bhojpuri", "telugu", "tamil",
    "punjabi", "malayalam", "kannada", "bengali", "marathi", "gujarati", "odia",
    "urdu", "mumbai", "delhi", "bangalore", "hyderabad", "chennai", "kolkata",
    "pune", "ahmedabad", "jaipur", "lucknow", "surat", "patna", "indore",
    "bhopal", "chandigarh", "nagpur", "thane", "agra", "varanasi",
    "jakarta", "bali", "surabaya", "bandung", "medan", "semarang",
    "makassar", "depok", "palembang", "yogyakarta",
    "malaysia", "kuala lumpur", "georgetown", "johor", "penang", "melaka",
    "kuching", "singapore",
    "manila", "cebu", "davao", "quezon", "makati",
    "bangkok", "phuket", "pattaya", "chiang mai", "hat yai",
    "hanoi", "saigon", "danang", "haiphong",
    "yangon", "mandalay", "phnom penh", "siem reap",
    "vientiane", "colombo", "kandy", "galle",
    "kathmandu", "pokhara", "dhaka", "chittagong",
    "islamabad", "karachi", "lahore", "rawalpindi",
    "desi", "bhakti", "hanuman", "shiva", "krishna", "ganesha",
    "viralvideo", "trendingviral", "dusunlantam", "tayang",
    "pakistan", "bangladesh", "nepal", "sri lanka", "bhutan", "maldives",
    "pyaar", "bhai", "kya", "mera", "meri", "bhabhi", "jugaad",
    "kumar", "singh", "sharma", "anil", "komal", "apu",
    "guru", "mahabharat", "ramayan", "krishna", "arman", "rahul",
    "indonesia", "indonesian", "vietnam", "vietnamese",
    "philippines", "filipino", "tagalog", "thailand",
    "cambodia", "khmer", "myanmar", "burmese", "laos", "laotian",
    "gara-gara", "lucu", "ngakak", "kocak", "mantap", "banget", "bocil",
    "cewek", "cowok", "prank lucu", "tiktok indo", "uzze", "rimba",
    "sunda", "jawa", "batak", "minang", "bugis", "dayak",
    "masuk angin", "shorts indo", "viral indo", "trending indo",
    "kollywood", "tollywood", "sandalwood", "mollywood",
    "bhangra",
    "bhajan", "aarti", "mandir", "pooja",
    "masala", "chai", "curry", "naan", "biryani", "roti",
    "gulab jamun", "jalebi", "samosa", "paneer",
    "tandoori", "korma", "vindaloo", "chutney", "lassi",
    "nasi goreng", "mie goreng", "sate", "rendang", "gado-gado",
    "bakso", "martabak", "pempek", "soto", "rawon", "sambal",
    "banh mi", "bun cha", "goi cuon", "cha gio",
    "pad thai", "tom yum", "som tam", "green curry",
    "adobo", "sinigang", "lechon", "sisig", "kare-kare",
    "satay", "laksa", "nasi lemak", "roti canai",
    "adik", "kakak", "adek", "abang", "mbak", "nenek", "kakek",
])

_REJECT_PHRASES = frozenset([
    "tamil movie", "tamil song", "hindi movie", "hindi song",
    "bollywood song", "bollywood movie",
    "bhojpuri song", "punjabi song", "punjabi movie",
    "telugu movie", "telugu song", "kannada movie", "kannada song",
    "malayalam movie", "malayalam song", "marathi movie", "marathi song",
    "gujarati movie", "gujarati song", "odia song", "bangla song",
    "indian food", "indian recipe", "indian street food",
    "indian comedy", "indian webseries",
    "spiritual india", "yoga india",
    "video panjang",
    "ho chi minh",
])

_REJECT_HASHTAGS = frozenset([
    "india", "indonesia", "desi", "bollywood", "hindi",
    "telugu", "tamil", "malayalam", "kannada", "bengali",
    "punjabi", "marathi", "gujarati", "odia", "urdu",
    "bhojpuri", "vietnam", "vietnamese", "thailand", "thai",
    "philippines", "tagalog", "malaysia", "indonesian",
    "bhfyp", "reelsindia", "trendingreels",
])

_INDIC_UNICODE = re.compile(
    r'[\u0900-\u0D7F\u0E00-\u0E7F\u0E80-\u0EFF\u1780-\u17FF'
    r'\u1000-\u109F\u1B00-\u1B7F\u1B80-\u1BBF\uA980-\uA9DF'
    r'\uAA00-\uAA5F\u1A00-\u1A1F\u1C00-\u1C4F\uA840-\uA87F'
    r'\u0B80-\u0BFF\u0C80-\u0CFF\u0D00-\u0D7F]'
)

_BLOCKED_COUNTRIES = frozenset([
    'IN', 'ID', 'PK', 'BD', 'NP', 'LK', 'MY', 'PH', 'TH',
    'VN', 'KH', 'MM', 'LA', 'BN', 'TL', 'MV', 'BT',
])

_CHANNEL_HANDLE_REGEX = re.compile(
    r'/@[\w.]*(?:india|indonesia|vietnam|vietnamese|philippines|'
    r'filipino|tagalog|thailand|malaysia|pakistan|bangladesh|'
    r'nepal|cambodia|myanmar|burma|desi|bollywood|bhojpuri|'
    r'telugu|tamil|punjabi|kannada|malayalam|bengali|marathi|gujarati|'
    r'odia|urdu)[\w.]*',
    re.IGNORECASE
)

# Indian/SE Asian last names (longer, less likely to collide with English)
_NAMES_REGEX = re.compile(
    r'\b(?:'
    r'singh|sharma|kumar|verma|gupta|agarwal|jain|'
    r'mishra|pandey|tiwari|dubey|shukla|trivedi|chaturvedi|'
    r'pandit|shastri|acharya|upadhyay|nair|menon|pillai|'
    r'iyer|iyengar|reddy|naidu|chowdhury|sarkar|das|'
    r'ghosh|banerjee|chatterjee|mukherjee|roy|sen|pal|'
    r'bose|saha|majumder|biswas|chakraborty|bhattacharya|'
    r'patel|shah|desai|mehta|joshi|patil|kulkarni|'
    r'deshmukh|pawar|more|jadhav|gaikwad|shinde|'
    r'wong|lim|tan|ong|nguyen|tran|pham|hoang|'
    r'santoso|wijaya|kusuma|putra|pratama|saputra|'
    r'phung|luong|huynh|truong|'
    r')\b',
    re.IGNORECASE
)


def is_blocked_region(
    channel_name: str = "",
    video_title: str = "",
    video_desc: str = "",
    channel_country: str = None,
    channel_url: str = None,
) -> bool:
    combined = f"{channel_name} {video_title} {video_desc}".lower()
    if _INDIC_UNICODE.search(combined):
        return True
    if channel_country and channel_country.upper() in _BLOCKED_COUNTRIES:
        return True
    if channel_url and _CHANNEL_HANDLE_REGEX.search(channel_url):
        return True
    tokens = set(combined.replace("#", " #").split())
    for word in tokens:
        word = word.strip("#").strip()
        if word in _REJECT_WORDS:
            return True
    if _NAMES_REGEX.search(combined):
        return True
    combined_nospace = combined.replace(" ", "")
    for phrase in _REJECT_PHRASES:
        p = phrase.replace(" ", "")
        if p in combined_nospace:
            return True
    for tag in _REJECT_HASHTAGS:
        if f"#{tag}" in combined:
            return True
    return False
