function getRecaptchaMode() {
  var config = parseQueryString(location.hash);
  return config['recaptcha'] === 'invisible' ?
      'invisible' : 'normal';
}

function getEmailSignInMethod() {
  var config = parseQueryString(location.hash);
  return config['emailSignInMethod'] === 'password' ?
      'password' : 'emailLink';
}

function parseQueryString(queryString) {
  if (queryString.length &&
      (queryString.charAt(0) == '#' || queryString.charAt(0) == '?')) {
    queryString = queryString.substring(1);
  }
  var config = {};
  var pairs = queryString.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].split('=');
    if (pair.length == 2) {
      config[pair[0]] = pair[1];
    }
  }
  return config;
}
