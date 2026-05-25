import { isValid } from "date-fns"

/**
 * Robustly parse dates in various formats like DD/MM/YYYY, MM/DD/YYYY, or ISO
 */
export const parseRobustDate = (rawStr: string) => {
    if (!rawStr) return null;
    let d = (rawStr.includes('-') || rawStr.includes('T')) ? new Date(rawStr) : new Date(rawStr);
    if (rawStr.includes('/')) {
        const parts = rawStr.split('/');
        if (parts.length === 3) {
            const p0 = parseInt(parts[0], 10);
            const p1 = parseInt(parts[1], 10);
            const p2 = parseInt(parts[2], 10);
            if (p1 > 12 && p0 <= 12) {
                d = new Date(`${p2}-${p0.toString().padStart(2, '0')}-${p1.toString().padStart(2, '0')}T12:00:00Z`);
            } else if (p0 > 12 && p1 <= 12) {
                d = new Date(`${p2}-${p1.toString().padStart(2, '0')}-${p0.toString().padStart(2, '0')}T12:00:00Z`);
            } else if (p0 <= 12 && p1 <= 12) {
                // Ambiguous, typical for UK/IN is DD/MM/YYYY
                d = new Date(p2, p1 - 1, p0, 12, 0, 0);
            }
            if (!isValid(d)) d = new Date(rawStr);
        }
    }
    return isValid(d) ? d : null;
};
