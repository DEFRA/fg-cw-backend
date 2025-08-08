import Boom from "@hapi/boom";
import jwksClient from "jwks-rsa";
import * as jwt from "jsonwebtoken";

export const fetchAndValidateTokenPublic = async (token) => {
  try {
    const client = jwksClient({
      jwksUri: "https://login.microsoftonline.com/common/discovery/v2.0/keys",
    });

    const keys = await client.getKeys();

    const publicKids = keys.map((key) => key.kid);

    const tokenKid = retrieveKidFromToken(token);

    console.log("tokenKid", tokenKid);
    if (!publicKids.includes(tokenKid)) {
      throw Boom.unauthorized(
        "The kid in the token does not match any keys in the JWKS.",
      );
    }

    console.log("KID validation successful!");
    return true;
  } catch (error) {
    throw Boom.conflict(`Error fetching public keys: ${error.message}`);
  }
};

export const retrieveKidFromToken = (token) => {
  const decodedHeader = jwt.decode(token, { complete: true });

  if (!decodedHeader || !decodedHeader.header) {
    throw Boom.badRequest("Invalid token format.");
  }

  return decodedHeader.header.kid;
};
