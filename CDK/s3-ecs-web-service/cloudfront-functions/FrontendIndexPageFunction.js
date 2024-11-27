function handler(event) {
  const request = event.request;
  const uri = request.uri;

  // index.htmlへのリクエストを同じディレクトリの親パスにリダイレクト
  if (uri.endsWith("/index.html")) {
    // パスの末尾の "index.html" を除外してリダイレクト先を決定
    const redirectUri = uri.replace("/index.html", "/");
    return {
      statusCode: 301,
      headers: {
        location: {
          value: redirectUri,
        },
      },
    };
  }

  // URIにファイル名がない場合
  if (uri.endsWith("/")) {
    request.uri += "index.html";
  }
  // URIに拡張子がない場合
  else if (!uri.includes(".")) {
    request.uri += "/index.html";
  }

  return request;
}
