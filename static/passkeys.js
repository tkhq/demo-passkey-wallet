$(document).ready(function() {
  const registrationOptions = function(username) {
    return {  
      // TODO: this challenge should come from the server!
      challenge: new TextEncoder().encode("something not-so-random"),  
      rp: {  
        name: "Your Local Piggybank",  
        id: "localhost",  
      },  
      user: {  
        id: new TextEncoder().encode(crypto.randomUUID()),  
        name: username,  
        displayName: "",  
      },  
      pubKeyCredParams: [{alg: -7, type: "public-key"},{alg: -257, type: "public-key"}],  
      // TODO: this should contain a list of already registered credentials for this user.
      excludeCredentials: [],  
      authenticatorSelection: {  
        requireResidentKey: true,  
      }  
    };
  }
  // Feature detection code from https://web.dev/passkey-registration/
  // This simply hides/shows the passkey UI elements depending on support.
  // Piggybank doesn't support any other authentication method than passkeys,
  // but other applications may choose to support e.g. oauth or password-based auth
  // when passkeys aren't supported.
  if (window.PublicKeyCredential &&  
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&  
    PublicKeyCredential.isConditionalMediationAvailable) {  
    Promise.all([  
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),  
      PublicKeyCredential.isConditionalMediationAvailable(),  
    ]).then(results => {  
      if (results.every(r => r === true)) {  
        $('.passkeys-supported').removeClass('hidden');
        $('.passkeys-unsupported').addClass('hidden');
      }
    });
  }

  // Registration: create a passkey!
  $(".passkey-registration").click(function(e) {
    e.preventDefault();

    const options = registrationOptions($("#inputUsername").val());
    navigator.credentials.create({  
      publicKey: options  
    }).then(console.log).catch(console.error);

  })
  
  
  // Encode and send the credential to the server for verification. 
}) 
