export const setObjectPath = (obj, value, ...args) => {
  const arg = args.shift();

  if (args.length === 0) {
    obj[arg] = value;
    return;
  } else {
    if (!obj[arg]) {
      obj[arg] = {};
    }
  }

  return setObjectPath(obj[arg], value, ...args);
};

export const path = (obj, ...args) => {
  const arg = args.shift();
  if (obj[arg]) {
    if (!args.length) {
      return true;
    }
    return path(obj[arg], ...args);
  } else {
    return false;
  }
};
