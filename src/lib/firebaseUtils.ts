/**
 * Formats data for Firestore by removing any 'undefined' values recursively,
 * as Firestore throws an error if an 'undefined' value is encountered.
 */
export const cleanData = (obj: any): any => {
    if (obj === null || obj === undefined) return null;

    if (Array.isArray(obj)) {
        return obj.map(item => cleanData(item));
    }

    if (typeof obj === 'object') {
        return Object.entries(obj).reduce((acc, [key, value]) => {
            if (value !== undefined) {
                acc[key] = cleanData(value);
            }
            return acc;
        }, {} as any);
    }

    return obj;
};

/**
 * Recursively converts Firestore Timestamps to serializable strings (ISO).
 * Useful before dispatching data to Redux.
 */
export const makeSerializable = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;

    // Check if it's a Firestore Timestamp
    if (typeof obj.toDate === 'function') {
        return obj.toDate().toISOString();
    }

    if (Array.isArray(obj)) {
        return obj.map(item => makeSerializable(item));
    }

    if (typeof obj === 'object') {
        const newObj: any = {};
        for (const [key, value] of Object.entries(obj)) {
            newObj[key] = makeSerializable(value);
        }
        return newObj;
    }

    return obj;
};
