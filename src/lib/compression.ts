/**
 * Native implementation of LZ-string's decompressFromEncodedURIComponent function
 */

import logger from "../logger";

const keyStrUriSafe = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$';

const baseReverseDic: Record<string, number> = {};
for (let i = 0; i < keyStrUriSafe.length; i++) {
  baseReverseDic[keyStrUriSafe[i]] = i;
}

export function decompressFromEncodedURIComponent(input: string | null | undefined): string {
  if (input === null || input === undefined || input === '') return '';
  
  try {
    const safeInput = input.replace(/ /g, '+');
    
    return _decompress(safeInput.length, 32, (index) => {
      return baseReverseDic[safeInput.charAt(index)];
    });
  } catch (e) {
    logger.error('Failed to decompress string:', e);
    return '';
  }
}

function _decompress(length: number, resetValue: number, getNextValue: (index: number) => number): string {
  const dictionary: string[] = [];
  let enlargeIn = 4;
  let dictSize = 4;
  let numBits = 3;
  let entry = '';
  const result: string[] = [];
  let w: string = '';
  let bits = 0, resb = 0, maxpower = 0, power = 0;
  let c: string | number = '';
  const data = {
    val: getNextValue(0),
    position: resetValue,
    index: 1
  };

  for (let i = 0; i < 3; i += 1) {
    dictionary[i] = String(i);
  }

  bits = 0;
  maxpower = Math.pow(2, 2);
  power = 1;
  
  while (power !== maxpower) {
    resb = data.val & data.position;
    data.position >>= 1;
    
    if (data.position === 0) {
      data.position = resetValue;
      data.val = getNextValue(data.index++);
    }
    
    bits |= (resb > 0 ? 1 : 0) * power;
    power <<= 1;
  }

  switch (bits) {
    case 0:
      bits = 0;
      maxpower = Math.pow(2, 8);
      power = 1;
      while (power !== maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position === 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }
      c = String.fromCharCode(bits);
      break;
    case 1:
      bits = 0;
      maxpower = Math.pow(2, 16);
      power = 1;
      while (power !== maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position === 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }
      c = String.fromCharCode(bits);
      break;
    case 2:
      return '';
  }

  dictionary[3] = c as string;
  w = c as string;
  result.push(c as string);

  while (true) {
    if (data.index > length) {
      return '';
    }

    bits = 0;
    maxpower = Math.pow(2, numBits);
    power = 1;
    
    while (power !== maxpower) {
      resb = data.val & data.position;
      data.position >>= 1;
      
      if (data.position === 0) {
        data.position = resetValue;
        data.val = getNextValue(data.index++);
      }
      
      bits |= (resb > 0 ? 1 : 0) * power;
      power <<= 1;
    }

    c = bits;
    switch (c) {
      case 0:
        bits = 0;
        maxpower = Math.pow(2, 8);
        power = 1;
        
        while (power !== maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          
          if (data.position === 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }

        dictionary[dictSize] = String.fromCharCode(bits);
        dictSize++;
        c = dictSize - 1;
        enlargeIn--;
        break;
      case 1:
        bits = 0;
        maxpower = Math.pow(2, 16);
        power = 1;
        
        while (power !== maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          
          if (data.position === 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        
        dictionary[dictSize] = String.fromCharCode(bits);
        dictSize++;
        c = dictSize - 1;
        enlargeIn--;
        break;
      case 2:
        return result.join('');
    }

    if (enlargeIn === 0) {
      enlargeIn = Math.pow(2, numBits);
      numBits++;
    }

    if (dictionary[c as number]) {
      entry = dictionary[c as number];
    } else {
      if ((c as number) === dictSize) {
        entry = w + w.charAt(0);
      } else {
        return null as any;
      }
    }
    
    result.push(entry);
    dictionary[dictSize] = w + entry.charAt(0);
    dictSize++;
    enlargeIn--;
    w = entry;

    if (enlargeIn === 0) {
      enlargeIn = Math.pow(2, numBits);
      numBits++;
    }
  }
} 