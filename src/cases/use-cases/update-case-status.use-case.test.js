import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthenticatedUser } from "../../common/auth.js";
import { Case } from "../models/case.js";
import { publishCaseStatusUpdated } from "../publishers/case-event.publisher.js";
import { findById, update } from "../repositories/case.repository.js";
import { updateCaseStatusUseCase } from "./update-case-status.use-case.js";

vi.mock("../../common/auth.js");
vi.mock("../repositories/case.repository.js");
vi.mock("../publishers/case-event.publisher.js");

describe("updateCaseStatusUseCase", () => {
  const validUserId = new ObjectId().toHexString();
  const authenticatedUser = { id: validUserId };

  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockReturnValue(authenticatedUser);
  });

  describe("successful status update", () => {
    it("updates case status to APPROVED", async () => {
      const mockCase = Case.createMock();
      mockCase.caseRef = "CASE-123";
      mockCase.status = "NEW";

      const command = {
        caseId: mockCase._id,
        status: "APPROVED",
      };

      findById.mockResolvedValue(mockCase);
      mockCase.updateStatus = vi.fn();
      update.mockResolvedValue(mockCase);
      publishCaseStatusUpdated.mockResolvedValue();

      await updateCaseStatusUseCase(command);

      expect(findById).toHaveBeenCalledWith(mockCase._id);
      expect(mockCase.updateStatus).toHaveBeenCalledWith(
        "APPROVED",
        authenticatedUser.id,
      );
      expect(update).toHaveBeenCalledWith(mockCase);
      expect(publishCaseStatusUpdated).toHaveBeenCalledWith({
        caseRef: "CASE-123",
        workflowCode: "workflow-code",
        previousStatus: mockCase.previousStatus,
        currentStatus: mockCase.currentStatus,
      });
    });

    it("updates case status to REJECTED", async () => {
      const mockCase = Case.createMock();
      mockCase.caseRef = "CASE-456";
      mockCase.status = "NEW";

      const command = {
        caseId: mockCase._id,
        status: "REJECTED",
      };

      findById.mockResolvedValue(mockCase);
      mockCase.updateStatus = vi.fn();
      update.mockResolvedValue(mockCase);
      publishCaseStatusUpdated.mockResolvedValue();

      await updateCaseStatusUseCase(command);

      expect(mockCase.updateStatus).toHaveBeenCalledWith(
        "REJECTED",
        authenticatedUser.id,
      );
      expect(publishCaseStatusUpdated).toHaveBeenCalledWith({
        caseRef: "CASE-456",
        workflowCode: "workflow-code",
        previousStatus: mockCase.previousStatus,
        currentStatus: mockCase.currentStatus,
      });
    });

    it("handles status update with different authenticated user", async () => {
      const specificUserId = "user-specific-456";
      getAuthenticatedUser.mockReturnValue({ id: specificUserId });

      const mockCase = Case.createMock();
      mockCase.caseRef = "CASE-789";

      const command = {
        caseId: mockCase._id,
        status: "APPROVED",
      };

      findById.mockResolvedValue(mockCase);
      mockCase.updateStatus = vi.fn();
      update.mockResolvedValue(mockCase);
      publishCaseStatusUpdated.mockResolvedValue();

      await updateCaseStatusUseCase(command);

      expect(mockCase.updateStatus).toHaveBeenCalledWith(
        "APPROVED",
        specificUserId,
      );
    });
  });

  describe("error handling", () => {
    it("throws NotFound error when case is not found", async () => {
      const command = {
        caseId: "non-existent-case-id",
        status: "APPROVED",
      };

      findById.mockResolvedValue(null);

      await expect(updateCaseStatusUseCase(command)).rejects.toThrow(
        Boom.notFound('Case with id "non-existent-case-id" not found'),
      );

      expect(findById).toHaveBeenCalledWith("non-existent-case-id");
      expect(update).not.toHaveBeenCalled();
      expect(publishCaseStatusUpdated).not.toHaveBeenCalled();
    });

    it("throws error when case updateStatus fails", async () => {
      const mockCase = Case.createMock();

      const command = {
        caseId: mockCase._id,
        status: "APPROVED",
      };

      const statusError = Boom.badRequest("Invalid status transition");

      findById.mockResolvedValue(mockCase);
      mockCase.updateStatus = vi.fn(() => {
        throw statusError;
      });

      await expect(updateCaseStatusUseCase(command)).rejects.toThrow(
        statusError,
      );

      expect(mockCase.updateStatus).toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(publishCaseStatusUpdated).not.toHaveBeenCalled();
    });

    it("throws error when repository update fails", async () => {
      const mockCase = Case.createMock();

      const command = {
        caseId: mockCase._id,
        status: "APPROVED",
      };

      const updateError = new Error("Database update failed");

      findById.mockResolvedValue(mockCase);
      mockCase.updateStatus = vi.fn();
      update.mockRejectedValue(updateError);

      await expect(updateCaseStatusUseCase(command)).rejects.toThrow(
        updateError,
      );

      expect(update).toHaveBeenCalledWith(mockCase);
      expect(publishCaseStatusUpdated).not.toHaveBeenCalled();
    });

    it("throws error when publishing fails", async () => {
      const mockCase = Case.createMock();

      const command = {
        caseId: mockCase._id,
        status: "APPROVED",
      };

      const publishError = new Error("Publishing failed");

      findById.mockResolvedValue(mockCase);
      mockCase.updateStatus = vi.fn();
      update.mockResolvedValue(mockCase);
      publishCaseStatusUpdated.mockRejectedValue(publishError);

      await expect(updateCaseStatusUseCase(command)).rejects.toThrow(
        publishError,
      );

      expect(publishCaseStatusUpdated).toHaveBeenCalled();
    });

    it("throws error when getAuthenticatedUser fails", async () => {
      const mockCase = Case.createMock();

      const command = {
        caseId: mockCase._id,
        status: "APPROVED",
      };

      const authError = Boom.unauthorized("No authenticated user");

      findById.mockResolvedValue(mockCase);
      getAuthenticatedUser.mockImplementation(() => {
        throw authError;
      });

      await expect(updateCaseStatusUseCase(command)).rejects.toThrow(authError);

      expect(findById).toHaveBeenCalledWith(mockCase._id);
      expect(update).not.toHaveBeenCalled();
      expect(publishCaseStatusUpdated).not.toHaveBeenCalled();
    });
  });
});
