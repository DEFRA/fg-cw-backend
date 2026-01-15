import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { User } from "../models/user.js";
import { findById, update } from "../repositories/user.repository.js";
import { updateLoginUseCase } from "./update-login.use-case.js";

vi.mock("../repositories/user.repository.js");

describe("updateLoginUseCase", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T10:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("updates lastLoginAt for existing user", async () => {
    const existingUser = User.createMock({
      id: "507f1f77bcf86cd799439011",
      lastLoginAt: "2024-12-01T10:00:00.000Z",
      updatedAt: "2024-12-01T10:00:00.000Z",
    });

    findById.mockResolvedValue(existingUser);

    const result = await updateLoginUseCase({
      userId: "507f1f77bcf86cd799439011",
    });

    expect(findById).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
    expect(result.lastLoginAt).toBe("2025-01-15T10:30:00.000Z");
    expect(result.updatedAt).toBe("2025-01-15T10:30:00.000Z");
    expect(update).toHaveBeenCalledWith(result);
  });

  it("returns null when user not found", async () => {
    findById.mockResolvedValue(null);

    const result = await updateLoginUseCase({
      userId: "nonexistent-user-id",
    });

    expect(findById).toHaveBeenCalledWith("nonexistent-user-id");
    expect(result).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("overwrites previous lastLoginAt timestamp", async () => {
    const existingUser = User.createMock({
      id: "507f1f77bcf86cd799439011",
      lastLoginAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
    });

    findById.mockResolvedValue(existingUser);

    const result = await updateLoginUseCase({
      userId: "507f1f77bcf86cd799439011",
    });

    expect(result.lastLoginAt).toBe("2025-01-15T10:30:00.000Z");
    expect(result.lastLoginAt).not.toBe("2020-01-01T00:00:00.000Z");
  });

  it("sets lastLoginAt and updatedAt to the same timestamp", async () => {
    const existingUser = User.createMock({
      id: "507f1f77bcf86cd799439011",
    });

    findById.mockResolvedValue(existingUser);

    const result = await updateLoginUseCase({
      userId: "507f1f77bcf86cd799439011",
    });

    expect(result.lastLoginAt).toBe("2025-01-15T10:30:00.000Z");
    expect(result.updatedAt).toBe("2025-01-15T10:30:00.000Z");
    expect(result.lastLoginAt).toBe(result.updatedAt);
  });

  it("does not modify other user properties", async () => {
    const existingUser = User.createMock({
      id: "507f1f77bcf86cd799439011",
      name: "Original Name",
      email: "original@email.com",
      idpRoles: ["ORIGINAL_ROLE"],
    });

    findById.mockResolvedValue(existingUser);

    const result = await updateLoginUseCase({
      userId: "507f1f77bcf86cd799439011",
    });

    expect(result.name).toBe("Original Name");
    expect(result.email).toBe("original@email.com");
    expect(result.idpRoles).toEqual(["ORIGINAL_ROLE"]);
  });
});
