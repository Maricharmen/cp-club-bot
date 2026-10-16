const { randomInt } = require('node:crypto');

// Sin caracteres ambiguos (0/O, 1/I/L) para que el código se pueda dictar en clase.
const OTP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generarCodigoOTP(longitud = 6) {
  let codigo = '';
  for (let i = 0; i < longitud; i++) {
    codigo += OTP_ALPHABET[randomInt(OTP_ALPHABET.length)];
  }
  return codigo;
}

module.exports = { generarCodigoOTP, OTP_ALPHABET };
