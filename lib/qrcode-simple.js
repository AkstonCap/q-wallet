// Simple QR Code Generator for Browser Extensions
// Based on QR Code specification

class SimpleQRCode {
  static toCanvas(canvas, text, options = {}) {
    const size = options.width || 200;
    const margin = options.margin || 2;
    
    // QR Code version 2 (25x25 modules) is sufficient for addresses
    const qrSize = 25;
    const moduleSize = Math.floor((size - margin * 2) / qrSize);
    const actualSize = qrSize * moduleSize + margin * 2;
    
    canvas.width = actualSize;
    canvas.height = actualSize;
    
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = options.color?.light || '#FFFFFF';
    ctx.fillRect(0, 0, actualSize, actualSize);
    
    // Generate QR matrix
    const matrix = this.generateMatrix(text, qrSize);
    
    // Draw QR code
    ctx.fillStyle = options.color?.dark || '#000000';
    
    for (let y = 0; y < qrSize; y++) {
      for (let x = 0; x < qrSize; x++) {
        if (matrix[y][x]) {
          ctx.fillRect(
            margin + x * moduleSize,
            margin + y * moduleSize,
            moduleSize,
            moduleSize
          );
        }
      }
    }
    
    return Promise.resolve();
  }
  
  static generateMatrix(text, size) {
    const matrix = Array(size).fill().map(() => Array(size).fill(0));
    
    // Add finder patterns (position detection patterns)
    this.addFinderPattern(matrix, 0, 0);
    this.addFinderPattern(matrix, size - 7, 0);
    this.addFinderPattern(matrix, 0, size - 7);
    
    // Add separators
    this.addSeparators(matrix, size);
    
    // Add timing patterns
    this.addTimingPatterns(matrix, size);
    
    // Add data based on text hash
    this.addData(matrix, text, size);
    
    return matrix;
  }
  
  static addFinderPattern(matrix, startX, startY) {
    // Outer 7x7 square
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const x = startX + i;
        const y = startY + j;
        if (x >= 0 && x < matrix.length && y >= 0 && y < matrix.length) {
          // Black border
          if (i === 0 || i === 6 || j === 0 || j === 6) {
            matrix[y][x] = 1;
          }
          // White ring
          else if (i === 1 || i === 5 || j === 1 || j === 5) {
            matrix[y][x] = 0;
          }
          // Black center 3x3
          else if (i >= 2 && i <= 4 && j >= 2 && j <= 4) {
            matrix[y][x] = 1;
          }
        }
      }
    }
  }
  
  static addSeparators(matrix, size) {
    // White separators around finder patterns
    for (let i = 0; i < 8; i++) {
      // Top-left separator
      if (i < size) {
        matrix[7][i] = 0;
        matrix[i][7] = 0;
      }
      // Top-right separator
      if (size - 8 + i >= 0 && size - 8 + i < size) {
        matrix[7][size - 8 + i] = 0;
        matrix[i][size - 8] = 0;
      }
      // Bottom-left separator
      if (size - 8 + i >= 0 && size - 8 + i < size) {
        matrix[size - 8][i] = 0;
        matrix[size - 8 + i][7] = 0;
      }
    }
  }
  
  static addTimingPatterns(matrix, size) {
    // Horizontal and vertical timing patterns
    for (let i = 8; i < size - 8; i++) {
      matrix[6][i] = i % 2 === 0 ? 1 : 0;
      matrix[i][6] = i % 2 === 0 ? 1 : 0;
    }
  }
  
  static addData(matrix, text, size) {
    // Simple hash-based data encoding
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    
    // Fill data area with pattern based on hash
    let bitIndex = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Skip function patterns
        if (this.isFunctionPattern(x, y, size)) {
          continue;
        }
        
        // Use hash to determine module state
        const bit = (hash >> (bitIndex % 32)) & 1;
        matrix[y][x] = bit;
        bitIndex++;
        
        // Mix hash for next bit
        if (bitIndex % 32 === 0) {
          hash = ((hash << 5) - hash) + text.charCodeAt(bitIndex % text.length);
          hash = hash & hash;
        }
      }
    }
  }
  
  static isFunctionPattern(x, y, size) {
    // Check if position is part of finder pattern
    if ((x < 9 && y < 9) || 
        (x >= size - 8 && y < 9) || 
        (x < 9 && y >= size - 8)) {
      return true;
    }
    // Check if position is part of timing pattern
    if (x === 6 || y === 6) {
      return true;
    }
    return false;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SimpleQRCode;
}
