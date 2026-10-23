import Boom from "@hapi/boom";

export const assertSupplementaryDataType = (
  supplementaryData,
  targetNode,
  dataType,
) => {
  if (!["ARRAY", "OBJECT"].includes(dataType)) {
    return;
  }
  if (
    Object.hasOwn(supplementaryData, targetNode) &&
    Array.isArray(supplementaryData[targetNode]) !== (dataType === "ARRAY")
  ) {
    throw Boom.badData(
      `Supplementary data node "${targetNode}" is not an ${dataType} container`,
    );
  }
};

export const mergeSupplementaryDataObject = ({
  targetData,
  key,
  data,
  targetNode,
}) => {
  if (!key) {
    throw new Error(
      `Can not update supplementaryData "${targetNode}" as an object without a key`,
    );
  }
  return { ...targetData, [data[key]]: data };
};

export const mergeSupplementaryDataArray = ({ targetData, key, data }) => {
  const inArray = !!key && !!targetData.find((d) => d[key] === data[key]);

  if (inArray) {
    return targetData.reduce((acc, c) => {
      if (c[key] === data[key]) {
        acc.push(data);
      } else {
        acc.push(c);
      }
      return acc;
    }, []);
  } else {
    targetData.push(data);
    return targetData;
  }
};
