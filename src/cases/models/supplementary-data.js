import Boom from "@hapi/boom";
import { assertIsSupplementaryDataNode } from "./supplementary-data-node.schema.js";

const assertIsObject = (data) => {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw Boom.badData("Supplementary data must be an object");
  }
};

const isSupplementaryDataContainer = (node, dataType) =>
  node !== null &&
  typeof node === "object" &&
  Array.isArray(node) === (dataType === "ARRAY");

const assertSupplementaryDataType = (
  supplementaryData,
  targetNode,
  dataType,
) => {
  if (
    Object.hasOwn(supplementaryData, targetNode) &&
    !isSupplementaryDataContainer(supplementaryData[targetNode], dataType)
  ) {
    throw Boom.badData(
      `Supplementary data node "${targetNode}" is not an ${dataType} container`,
    );
  }
};

const mergeSupplementaryDataObject = ({
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

const mergeSupplementaryDataArray = ({ targetData, key, data }) => {
  if (!key || !targetData.some((entry) => entry[key] === data[key])) {
    return [...targetData, data];
  }
  return targetData.map((entry) => (entry[key] === data[key] ? data : entry));
};

const mergers = {
  ARRAY: mergeSupplementaryDataArray,
  OBJECT: mergeSupplementaryDataObject,
};

const emptyNode = (dataType) => (dataType === "ARRAY" ? [] : {});

export class SupplementaryData {
  #nodes;

  constructor(data = {}) {
    assertIsObject(data);
    this.#nodes = structuredClone(data);
  }

  getNode(targetNode) {
    return structuredClone(this.#nodes[targetNode]);
  }

  merge({ targetNode, dataType, key, data }) {
    if (!targetNode) {
      return this;
    }
    assertIsSupplementaryDataNode(targetNode);
    if (!["ARRAY", "OBJECT"].includes(dataType)) {
      return this;
    }
    assertSupplementaryDataType(this.#nodes, targetNode, dataType);
    const updated = mergers[dataType]({
      targetNode,
      key,
      data,
      targetData: this.#nodes[targetNode] ?? emptyNode(dataType),
    });
    return this.withNode(targetNode, updated);
  }

  withNode(targetNode, data) {
    assertIsSupplementaryDataNode(targetNode);
    const updated = new SupplementaryData();
    updated.#nodes = { ...this.#nodes, [targetNode]: structuredClone(data) };
    return updated;
  }

  toJSON() {
    return structuredClone(this.#nodes);
  }
}
