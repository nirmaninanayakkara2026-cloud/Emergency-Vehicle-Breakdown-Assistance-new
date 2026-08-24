export const RISK_LEVELS = {
  low: {
    label: "BASIC CHECK",
    title: "Basic Check",
    icon: "i",
    explanation: "Simple observations with minimal risk when performed carefully."
  },
  caution: {
    label: "CONTINUE WITH CARE",
    title: "Continue With Care",
    icon: "!",
    explanation: "Proceed only after reading the safety warning and confirming you understand it."
  },
  high: {
    label: "PROFESSIONAL HELP RECOMMENDED",
    title: "Professional Assistance Recommended",
    icon: "X",
    explanation: "Detailed repair instructions are not provided because this may be unsafe."
  }
};

export function getRiskDetails(riskLevel) {
  return RISK_LEVELS[riskLevel] || RISK_LEVELS.high;
}
