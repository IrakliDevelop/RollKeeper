export function getCRColor(cr: string): string {
    let crNum: number;
    if (cr.includes('/')) {
        const parts = cr.split('/');
        crNum = parseInt(parts[0]) / parseInt(parts[1]);
    } else {
        crNum = parseFloat(cr);
    }

    if (isNaN(crNum)) return 'bg-gray-600 text-white';
  
    if (crNum <= 1) return 'bg-green-600/80 text-green-100 border border-green-500/50';
    if (crNum <= 5) return 'bg-yellow-600/80 text-yellow-100 border border-yellow-500/50';
    if (crNum <= 10) return 'bg-orange-600/80 text-orange-100 border border-orange-500/50';
    if (crNum <= 20) return 'bg-red-600/80 text-red-100 border border-red-500/50';
    return 'bg-purple-600/80 text-purple-100 border border-purple-500/50';
}

/**
 * Convert single-letter size abbreviations to full size names
 */
export function formatSize(size?: string[]): string {
    const sizeMap: Record<string, string> = {
        'T': 'Tiny',
        'S': 'Small', 
        'M': 'Medium',
        'L': 'Large',
        'H': 'Huge',
        'G': 'Gargantuan'
    };

    // check if size is an array
    if (Array.isArray(size)) {
        return size.map(s => sizeMap[s.trim().toUpperCase()] || s).join(', ');
    }
    
    return 'Unknown';
}

/**
 * Convert alignment abbreviations to full alignment names
 */
export function formatAlignment(alignment: string): string {
    if (!alignment) return 'Unaligned';
    
    // Split by comma and trim each part
    const parts = alignment.split(',').map(part => part.trim());
    
    const alignmentMap: Record<string, string> = {
        'L': 'Lawful',
        'N': 'Neutral', 
        'C': 'Chaotic',
        'G': 'Good',
        'E': 'Evil',
        'U': 'Unaligned'
    };
    
    // Handle special cases
    if (parts.length === 1) {
        const single = parts[0].toUpperCase();
        if (single === 'U') return 'Unaligned';
        if (single === 'N') return 'True Neutral';
    }
    
    // Convert each part and join
    const converted = parts.map(part => {
        const upper = part.toUpperCase();
        return alignmentMap[upper] || part;
    });
    
    return converted.join(' ');
}
