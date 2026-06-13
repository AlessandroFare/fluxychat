String trimTrailingSlashes(String url) {
  var out = url;
  while (out.endsWith('/')) out = out.substring(0, out.length - 1);
  return out;
}
