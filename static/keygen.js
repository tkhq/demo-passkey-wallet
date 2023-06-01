$(document).ready(function() {

  async function generateP256KeyPair() {
    // Generate P-256 key pair
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      true,
      ["sign", "verify"]
    );
    
    // Export public key as "raw" (yields uncompressed format)
    const rawPublicKey = await window.crypto.subtle.exportKey(
      "raw",
      keyPair.publicKey
    );
    const compressedPublicKey = compressRawPublicKey(rawPublicKey);
    
    // Export private key a PKCS#8-encoded ArrayBuffer
    const privateKey = await window.crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey
    );

    return {
      privateKey: buf2hex(privateKey),
      publicKey: buf2hex(compressedPublicKey),
    }
  }

  // Accepts a public key array buffer, and returns a buffer with the compressed version of the public key
  function compressRawPublicKey(rawPublicKey) {
    const rawPublicKeyBytes = new Uint8Array(rawPublicKey)
    const len = rawPublicKeyBytes.byteLength

    // Drop the y coordinate
    var compressedBytes = rawPublicKeyBytes.slice(0, 1 + len >>> 1)

    // Encode the parity of `y` in first bit
    compressedBytes[0] = 0x2 | (rawPublicKeyBytes[len-1] & 0x01) 
    return compressedBytes.buffer
  }

  async function getDerivation(hash, salt, password, iterations, keyLength) {
    const textEncoder = new TextEncoder("utf-8");
    const passwordBuffer = textEncoder.encode(password);
    const importedKey = await crypto.subtle.importKey("raw", passwordBuffer, "PBKDF2", false, ["deriveBits"]);
    
    const saltBuffer = textEncoder.encode(salt);
    const params = {name: "PBKDF2", hash: hash, salt: saltBuffer, iterations: iterations};
    const derivation = await crypto.subtle.deriveBits(params, importedKey, keyLength*8);
    return derivation;
  }


  async function getKey(derivation) {
    const ivlen = 32;
    const keylen = 32;
    const derivedKey = derivation.slice(0, keylen);
    const iv = derivation.slice(ivlen);
    const importedEncryptionKey = await crypto.subtle.importKey('raw', derivedKey, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
    return {
      key: importedEncryptionKey,
      iv: iv
    }
  }

  // Converts an ArrayBuffer to its hexadecimal representation
  function buf2hex(buffer) {
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
  }

  function hexToUint8Array (hex) {
    return Uint8Array.from(
      hex.match(/.{1,2}/g).map(
        (byte) => parseInt(byte, 16)
      )
    );
  }

  async function encrypt(buffer, keyObject) {
    return await crypto.subtle.encrypt({ name: 'AES-CBC', iv: keyObject.iv }, keyObject.key, buffer);
  }

  async function decrypt(buffer, keyObject) {
    return await crypto.subtle.decrypt({ name: 'AES-CBC', iv: keyObject.iv }, keyObject.key, buffer);
  }

  
  //   // Import private key as CryptoKey
  //   const privateKey = await window.crypto.subtle.importKey(
  //     "pkcs8",
  //     decryptedPrivateKeyBytes,
  //     { name: "ECDSA", namedCurve: "P-256" },
  //     true,
  //     ["sign"]
  //   );
  
  //   // Sign message using private key
  //   const signature = await window.crypto.subtle.sign(
  //     { name: "ECDSA", hash: { name: "SHA-256" } },
  //     privateKey,
  //     new TextEncoder().encode(message)
  //   );
  
  //   // Return signature as base64-encoded string
  //   return btoa(String.fromCharCode(...new Uint8Array(signature)));
  // }

  $('#generate-api-key').click(async function() {
    // TODO: validate passphrase entropy!
    const passphrase = $("#passphrase").val();

    const keypair = await generateP256KeyPair()
    
    var result = $("#keygen-result")
    result.append("<p>Credentials generated! Encrypting...</p>");
    result.removeClass("hidden");

    // Populate and show the Create Wallet form
    // $("#input-public-key").val(keypair.publicKey);
    // $("#input-encrypted-private-key").val("Encrypting...");
    // $(".create-wallet").removeClass("hidden");
  
    const hash = "SHA-256";
    // TODO: this salt should be a random, per-user value instead of
    // being hardcoded here
    const salt = "SALTY";
    const iterations = 1000;
    const keyLength = 48;
    const derivation = await getDerivation(hash, salt, passphrase, iterations, keyLength);
    const keyObject = await getKey(derivation);
  
    // Call the encrypt function and populate the form field
    const privateKeyBytes = hexToUint8Array(keypair.privateKey);
    const encryptedObject = await encrypt(privateKeyBytes, keyObject);

    const finalEncryptedString = buf2hex(encryptedObject);

    const encryptedBuffer = hexToUint8Array(finalEncryptedString);

    // Now let's validate that we can get the same private key back!
    const decryptedBuffer = await decrypt(encryptedBuffer, keyObject);

    // ...and error out if that's (somehow!) the case.
    if (keypair.privateKey !== buf2hex(decryptedBuffer)) {
      console.error("woah! generated private key and decrypted private key do not match!", keypair, buf2hex(decryptedBuffer));
    }

    // Now we're ready to create our Turnkey API user
    $.post("/wallet/create", {
      encryptedPrivateKey: finalEncryptedString,
      publicKey: keypair.publicKey
    }, function(){
      alert("Success! Click to continue");
      window.location.reload();
    });

    window.dangerousDecrypt = async function(encryptedString, passphrase) {
      const encryptedBuffer = hexToUint8Array(encryptedString);
      const hash = "SHA-256";
      const salt = "SALTY";
      const iterations = 1000;
      const keyLength = 48;
      const derivation = await getDerivation(hash, salt, passphrase, iterations, keyLength);
      const keyObject = await getKey(derivation);
      // Now let's validate that we can get the same private key back!
      const decryptedBuffer = await decrypt(encryptedBuffer, keyObject);
      return buf2hex(decryptedBuffer)
    }
  });
}) 
