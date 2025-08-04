import Boom from "@hapi/boom";

export const assertIsArrayOfInstances = (value, Class, name = "object") => {
  if (!Array.isArray(value)) {
    throw Boom.badRequest(`Expected an array of ${name}s`);
  }

  value.forEach((item, index) => {
    try {
      assertInstanceOf(item, Class, name);
    } catch (err) {
      throw Boom.badRequest(
        `Item at index ${index} is not a valid ${name} instance`,
      );
    }
  });

  return value;
};

export const assertInstanceOf = (value, Class, name = "value") => {
  if (!(value instanceof Class)) {
    throw Boom.badRequest(`Must provide a valid ${name} object`);
  }
  return value;
};
