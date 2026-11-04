/** Built-in FAQ for the simulated support bot. Answers are fictional sample content. */

/** Languages the simulated bot can answer in. */
export type ReplyLanguage = "en" | "te" | "te-Latn" | "hi" | "hi-Latn";

export interface KbEntry {
  intent: string;
  /** English question keywords. */
  keywords: string[];
  /** Telugu, Hindi and romanized question keywords. */
  localKeywords: string[];
  answer: string;
  /** Translations of `answer`. */
  answers: Record<Exclude<ReplyLanguage, "en">, string>;
}

/**
 * Ordered from most to least specific: on equal keyword hits the earlier entry wins,
 * so "cancel my order" resolves to cancel_order rather than the generic order_status.
 */
export const MOCK_KNOWLEDGE_BASE: KbEntry[] = [
  {
    intent: "cancel_order",
    keywords: ["cancel", "cancellation"],
    localKeywords: ["రద్దు", "క్యాన్సిల్", "raddu", "रद्द", "कैंसिल", "radd"],
    answer:
      "You can cancel an order within 24 hours of placing it from My Orders > Cancel order. After it ships, request a return instead.",
    answers: {
      te: "ఆర్డర్ చేసిన 24 గంటల లోపు 'నా ఆర్డర్లు' నుండి దాన్ని రద్దు చేయవచ్చు. షిప్ అయిన తర్వాత రిటర్న్ కోసం అభ్యర్థించండి.",
      "te-Latn": "Order chesina 24 hours lopu 'My Orders' nunchi cancel cheyyochu. Ship ayina tarvata return request cheyandi.",
      hi: "आप ऑर्डर करने के 24 घंटे के भीतर 'मेरे ऑर्डर' से उसे रद्द कर सकते हैं। शिप होने के बाद रिटर्न का अनुरोध करें।",
      "hi-Latn": "Aap order karne ke 24 ghante ke andar 'My Orders' se cancel kar sakte hain. Ship hone ke baad return request karein.",
    },
  },
  {
    intent: "refund",
    keywords: ["refund", "money back", "return", "returned"],
    localKeywords: ["రీఫండ్", "వాపసు", "డబ్బులు", "vaapasu", "dabbulu", "रिफंड", "वापस", "पैसे", "wapas", "paise", "paisa"],
    answer:
      "Refunds go to your original payment method within 5-7 business days after we receive the returned item.",
    answers: {
      te: "రీఫండ్ మీ అసలు చెల్లింపు పద్ధతికి 5-7 పని దినాలలో జమ అవుతుంది.",
      "te-Latn": "Refund mee original payment method ki 5-7 working days lo vastundi.",
      hi: "रिफंड आपके मूल भुगतान माध्यम में 5-7 कार्यदिवसों में आ जाएगा।",
      "hi-Latn": "Refund aapke original payment method mein 5-7 working days mein aa jayega.",
    },
  },
  {
    intent: "password_reset",
    keywords: ["password", "reset", "forgot", "login", "log in", "sign in"],
    localKeywords: ["పాస్‌వర్డ్", "पासवर्ड"],
    answer:
      "To reset your password, select Forgot password on the sign-in page and follow the link we email you. The link expires in 30 minutes.",
    answers: {
      te: "పాస్‌వర్డ్ రీసెట్ చేయడానికి సైన్-ఇన్ పేజీలో 'పాస్‌వర్డ్ మర్చిపోయారా' ఎంచుకుని, ఈమెయిల్‌లో వచ్చిన లింక్‌ను అనుసరించండి.",
      "te-Latn": "Password reset cheyyadaniki sign-in page lo 'Forgot password' select chesi, email lo vachina link follow cheyandi.",
      hi: "पासवर्ड रीसेट करने के लिए साइन-इन पेज पर 'पासवर्ड भूल गए' चुनें और ईमेल में आए लिंक का पालन करें।",
      "hi-Latn": "Password reset karne ke liye sign-in page par 'Forgot password' chuniye aur email mein aaye link ko follow kijiye.",
    },
  },
  {
    intent: "payment_methods",
    keywords: ["payment", "pay", "upi", "card", "cash", "cod", "net banking"],
    localKeywords: ["చెల్లింపు", "యూపీఐ", "కార్డు", "भुगतान", "पेमेंट", "यूपीआई", "कार्ड", "bhugtan"],
    answer: "We accept UPI, credit and debit cards, net banking, and cash on delivery for orders under Rs 10,000.",
    answers: {
      te: "మేము UPI, క్రెడిట్ మరియు డెబిట్ కార్డులు, నెట్ బ్యాంకింగ్, క్యాష్ ఆన్ డెలివరీ అంగీకరిస్తాము.",
      "te-Latn": "Memu UPI, credit and debit cards, net banking, cash on delivery accept chestamu.",
      hi: "हम UPI, क्रेडिट और डेबिट कार्ड, नेट बैंकिंग और कैश ऑन डिलीवरी स्वीकार करते हैं।",
      "hi-Latn": "Hum UPI, credit aur debit card, net banking aur cash on delivery accept karte hain.",
    },
  },
  {
    intent: "delivery_time",
    keywords: ["delivery", "deliver", "shipping", "ship", "arrive", "how long"],
    localKeywords: ["డెలివరీ", "ఎప్పుడు వస్తుంది", "ఎన్ని రోజులు", "enni rojulu", "डिलीवरी", "कब आएगा", "कितने दिन", "kab", "kitne din", "aayega"],
    answer: "Standard delivery takes 3-5 business days. Express delivery arrives in 1-2 business days.",
    answers: {
      te: "సాధారణ డెలివరీకి 3-5 పని దినాలు పడుతుంది. ఎక్స్‌ప్రెస్ డెలివరీ 1-2 పని దినాలలో వస్తుంది.",
      "te-Latn": "Normal delivery ki 3-5 working days padutundi. Express delivery 1-2 days lo vastundi.",
      hi: "सामान्य डिलीवरी में 3-5 कार्यदिवस लगते हैं। एक्सप्रेस डिलीवरी 1-2 कार्यदिवस में पहुँचती है।",
      "hi-Latn": "Normal delivery mein 3-5 working days lagte hain. Express delivery 1-2 days mein pahunchti hai.",
    },
  },
  {
    intent: "support_hours",
    keywords: ["hours", "contact", "support", "phone", "call", "agent", "human"],
    localKeywords: ["సపోర్ట్", "సహాయం", "सपोर्ट", "सहायता"],
    answer: "Our support team is available 9 AM to 9 PM IST, Monday to Saturday, by chat or at 1800-123-4567.",
    answers: {
      te: "మా సపోర్ట్ టీమ్ సోమవారం నుండి శనివారం వరకు ఉదయం 9 నుండి రాత్రి 9 వరకు అందుబాటులో ఉంటుంది.",
      "te-Latn": "Maa support team Monday nunchi Saturday varaku 9 AM nunchi 9 PM varaku available ga untundi.",
      hi: "हमारी सपोर्ट टीम सोमवार से शनिवार, सुबह 9 बजे से रात 9 बजे तक उपलब्ध है।",
      "hi-Latn": "Hamari support team Monday se Saturday, subah 9 baje se raat 9 baje tak available hai.",
    },
  },
  {
    intent: "order_status",
    keywords: ["order", "status", "where", "track", "tracking", "package"],
    localKeywords: ["ఎక్కడ", "ట్రాక్", "స్థితి", "ఆర్డర్", "ekkada", "कहाँ", "कहां", "ट्रैक", "स्थिति", "ऑर्डर", "kahan", "kahaan"],
    answer:
      "You can track your order from My Orders. Open the order and select Track package to see the latest status and the courier tracking number.",
    answers: {
      te: "మీ ఆర్డర్‌ను 'నా ఆర్డర్లు' విభాగంలో ట్రాక్ చేయవచ్చు. ఆర్డర్‌ను తెరిచి తాజా స్థితిని చూడండి.",
      "te-Latn": "Mee order ni 'My Orders' lo track cheyyochu. Order open chesi latest status chudandi.",
      hi: "आप अपना ऑर्डर 'मेरे ऑर्डर' में ट्रैक कर सकते हैं। ऑर्डर खोलकर ताज़ा स्थिति देखें।",
      "hi-Latn": "Aap apna order 'My Orders' mein track kar sakte hain. Order kholkar latest status dekhiye.",
    },
  },
  {
    intent: "greeting",
    keywords: ["hi", "hello", "hey", "good morning", "good evening"],
    localKeywords: ["నమస్కారం", "నమస్తే", "హలో", "namaskaram", "नमस्ते", "हैलो", "namaste"],
    answer: "Hello! I'm the support assistant. How can I help you with your order today?",
    answers: {
      te: "నమస్కారం! నేను సపోర్ట్ అసిస్టెంట్‌ని. మీ ఆర్డర్ విషయంలో ఎలా సహాయం చేయగలను?",
      "te-Latn": "Namaskaram! Nenu support assistant ni. Mee order vishayam lo ela help cheyagalanu?",
      hi: "नमस्ते! मैं सपोर्ट असिस्टेंट हूँ। आपके ऑर्डर में मैं कैसे मदद कर सकता हूँ?",
      "hi-Latn": "Namaste! Main support assistant hoon. Aapke order mein main kaise madad kar sakta hoon?",
    },
  },
];

export const MOCK_FALLBACK_ANSWER =
  "I'm sorry, I don't have information about that. Could you rephrase your question or contact support?";

export const MOCK_FALLBACK_ANSWERS: Record<ReplyLanguage, string> = {
  en: MOCK_FALLBACK_ANSWER,
  te: "క్షమించండి, దాని గురించి నా దగ్గర సమాచారం లేదు. దయచేసి మళ్ళీ అడగండి.",
  "te-Latn": "Sorry, daani gurinchi naa daggara information ledu. Dayachesi malli adagandi.",
  hi: "माफ़ कीजिए, इसके बारे में मेरे पास जानकारी नहीं है। कृपया दोबारा पूछें।",
  "hi-Latn": "Maaf kijiye, iske baare mein mere paas jaankari nahi hai. Kripya dobara poochiye.",
};

export function answerIn(entry: KbEntry | null, language: ReplyLanguage): string {
  if (!entry) return MOCK_FALLBACK_ANSWERS[language];
  return language === "en" ? entry.answer : entry.answers[language];
}
