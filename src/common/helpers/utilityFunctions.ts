import { nanoid } from 'nanoid';

// Function to generate a unique ID using nanoid
export const generateNanoId = (): string => {
    return nanoid();
};

// Deep equality check function to compare two objects or arrays
export const deepEqual = (obj1: any, obj2: any): boolean => {
    // Check for reference equality
    if (obj1 === obj2) return true;
    // Check if either value is null or not an object
    if (
        obj1 === null ||
        obj2 === null ||
        typeof obj1 !== 'object' ||
        typeof obj2 !== 'object'
    ) {
        return false;
    }
    // If both are arrays, compare their elements
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
        if (obj1.length !== obj2.length) return false;
        for (let i = 0; i < obj1.length; i++) {
            if (!deepEqual(obj1[i], obj2[i])) return false;
        }
        return true;
    }
    // Get the keys of both objects
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    // Check if the number of keys is the same
    if (keys1.length !== keys2.length) return false;
    // Check each key for deep equality
    for (const key of keys1) {
        if (!obj2.hasOwnProperty(key)) return false; // Check if key exists in obj2
        if (!deepEqual(obj1[key], obj2[key])) return false; // Recursively check values
    }
    return true; // Objects are deeply equal
};
