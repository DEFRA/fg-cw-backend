import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthenticatedUser } from "../../common/auth.js";
import { Case } from "../models/case.js";
import { Workflow } from "../models/workflow.js";
import { publishCaseStatusUpdated } from "../publishers/case-event.publisher.js";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";
import { updateStageOutcomeUseCase } from "./update-stage-outcome.use-case.js";

vi.mock("../../common/auth.js");
vi.mock("../repositories/case.repository.js");
vi.mock("../repositories/workflow.repository.js");
vi.mock("../publishers/case-event.publisher.js");

describe("updateStageOutcomeUseCase", () => {
  const validUserId = new ObjectId().toHexString();
  const authenticatedUser = { id: validUserId };

  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockReturnValue(authenticatedUser);
  });

  describe("successful stage outcome update", () => {
    it("updates stage outcome with comment", async () => {
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();

      mockCase.currentStage = "stage-1";
      mockCase.caseRef = "CASE-123";

      const command = {
        caseId: mockCase._id,
        actionId: "approve",
        comment: "Application approved with conditions",
      };

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);
      mockWorkflow.validateStageActionComment = vi.fn();
      mockCase.updateStageOutcome = vi.fn();
      update.mockResolvedValue(mockCase);

      await updateStageOutcomeUseCase(command);

      expect(findById).toHaveBeenCalledWith(mockCase._id);
      expect(findByCode).toHaveBeenCalledWith(mockCase.workflowCode);
      expect(mockWorkflow.validateStageActionComment).toHaveBeenCalledWith({
        actionId: "approve",
        stageCode: "stage-1",
        comment: "Application approved with conditions",
      });
      expect(mockCase.updateStageOutcome).toHaveBeenCalledWith({
        actionId: "approve",
        comment: "Application approved with conditions",
        createdBy: authenticatedUser.id,
      });
      expect(update).toHaveBeenCalledWith(mockCase);
      expect(publishCaseStatusUpdated).toHaveBeenCalledWith({
        caseRef: "CASE-123",
        workflowCode: mockCase.workflowCode,
        previousStatus: "not-implemented",
        currentStatus: "APPROVED",
      });
    });

    it("updates stage outcome without comment", async () => {
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();

      mockCase.currentStage = "stage-2";
      mockCase.caseRef = "CASE-456";

      const command = {
        caseId: mockCase._id,
        actionId: "reject",
        comment: null,
      };

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);
      mockWorkflow.validateStageActionComment = vi.fn();
      mockCase.updateStageOutcome = vi.fn();
      update.mockResolvedValue(mockCase);

      await updateStageOutcomeUseCase(command);

      expect(mockWorkflow.validateStageActionComment).toHaveBeenCalledWith({
        actionId: "reject",
        stageCode: "stage-2",
        comment: null,
      });
      expect(mockCase.updateStageOutcome).toHaveBeenCalledWith({
        actionId: "reject",
        comment: null,
        createdBy: authenticatedUser.id,
      });
    });

    it("handles stage progression correctly", async () => {
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();

      const previousStage = "stage-1";
      const newStage = "stage-2";

      mockCase.currentStage = previousStage;
      mockCase.caseRef = "CASE-789";

      const command = {
        caseId: mockCase._id,
        actionId: "approve",
        comment: "Moving to next stage",
      };

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);
      mockWorkflow.validateStageActionComment = vi.fn();
      mockCase.updateStageOutcome = vi.fn(() => {
        mockCase.currentStage = newStage;
      });
      update.mockResolvedValue(mockCase);

      await updateStageOutcomeUseCase(command);

      expect(publishCaseStatusUpdated).toHaveBeenCalledWith({
        caseRef: "CASE-789",
        workflowCode: mockCase.workflowCode,
        previousStatus: "not-implemented",
        currentStatus: "APPROVED",
      });
    });

    it("uses authenticated user in stage outcome", async () => {
      const specificUserId = "user-specific-123";
      getAuthenticatedUser.mockReturnValue({ id: specificUserId });

      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();

      const command = {
        caseId: mockCase._id,
        actionId: "approve",
        comment: "Test comment",
      };

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);
      mockWorkflow.validateStageActionComment = vi.fn();
      mockCase.updateStageOutcome = vi.fn();
      update.mockResolvedValue(mockCase);

      await updateStageOutcomeUseCase(command);

      expect(mockCase.updateStageOutcome).toHaveBeenCalledWith({
        actionId: "approve",
        comment: "Test comment",
        createdBy: specificUserId,
      });
    });
  });

  describe("error handling", () => {
    it("throws NotFound error when case is not found", async () => {
      const command = {
        caseId: "non-existent-case-id",
        actionId: "approve",
        comment: "Test comment",
      };

      findById.mockResolvedValue(null);

      await expect(updateStageOutcomeUseCase(command)).rejects.toThrow(
        Boom.notFound('Case with id "non-existent-case-id" not found'),
      );

      expect(findById).toHaveBeenCalledWith("non-existent-case-id");
      expect(findByCode).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(publishCaseStatusUpdated).not.toHaveBeenCalled();
    });

    it("throws error when workflow validation fails", async () => {
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();

      const command = {
        caseId: mockCase._id,
        actionId: "approve",
        comment: "",
      };

      const validationError = Boom.badRequest(
        "Comment is required for this action",
      );

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);
      mockWorkflow.validateStageActionComment = vi.fn(() => {
        throw validationError;
      });

      await expect(updateStageOutcomeUseCase(command)).rejects.toThrow(
        validationError,
      );

      expect(mockWorkflow.validateStageActionComment).toHaveBeenCalledWith({
        actionId: "approve",
        stageCode: mockCase.currentStage,
        comment: "",
      });
      expect(update).not.toHaveBeenCalled();
      expect(publishCaseStatusUpdated).not.toHaveBeenCalled();
    });

    it("throws error when case update fails", async () => {
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();

      const command = {
        caseId: mockCase._id,
        actionId: "approve",
        comment: "Test comment",
      };

      const updateError = new Error("Database update failed");

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);
      mockWorkflow.validateStageActionComment = vi.fn();
      mockCase.updateStageOutcome = vi.fn();
      update.mockRejectedValue(updateError);

      await expect(updateStageOutcomeUseCase(command)).rejects.toThrow(
        updateError,
      );

      expect(update).toHaveBeenCalledWith(mockCase);
      expect(publishCaseStatusUpdated).not.toHaveBeenCalled();
    });

    it("throws error when publishing fails", async () => {
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();

      const command = {
        caseId: mockCase._id,
        actionId: "approve",
        comment: "Test comment",
      };

      const publishError = new Error("Publishing failed");

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);
      mockWorkflow.validateStageActionComment = vi.fn();
      mockCase.updateStageOutcome = vi.fn();
      update.mockResolvedValue(mockCase);
      publishCaseStatusUpdated.mockRejectedValue(publishError);

      await expect(updateStageOutcomeUseCase(command)).rejects.toThrow(
        publishError,
      );

      expect(publishCaseStatusUpdated).toHaveBeenCalled();
    });

    it("throws error when updateStageOutcome on case fails", async () => {
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();

      const command = {
        caseId: mockCase._id,
        actionId: "approve",
        comment: "Test comment",
      };

      const caseError = Boom.badRequest("Cannot progress from this stage");

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);
      mockWorkflow.validateStageActionComment = vi.fn();
      mockCase.updateStageOutcome = vi.fn(() => {
        throw caseError;
      });

      await expect(updateStageOutcomeUseCase(command)).rejects.toThrow(
        caseError,
      );

      expect(mockCase.updateStageOutcome).toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(publishCaseStatusUpdated).not.toHaveBeenCalled();
    });
  });

  describe("workflow integration", () => {
    it("validates stage action comment with correct parameters", async () => {
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();

      mockCase.currentStage = "specific-stage-id";

      const command = {
        caseId: mockCase._id,
        actionId: "specific-action",
        comment: "specific comment text",
      };

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);
      mockWorkflow.validateStageActionComment = vi.fn();
      mockCase.updateStageOutcome = vi.fn();
      update.mockResolvedValue(mockCase);

      await updateStageOutcomeUseCase(command);

      expect(mockWorkflow.validateStageActionComment).toHaveBeenCalledWith({
        actionId: "specific-action",
        stageCode: "specific-stage-id",
        comment: "specific comment text",
      });
    });

    it("finds workflow by case workflow code", async () => {
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();

      mockCase.workflowCode = "specific-workflow-code";

      const command = {
        caseId: mockCase._id,
        actionId: "approve",
        comment: "Test comment",
      };

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);
      mockWorkflow.validateStageActionComment = vi.fn();
      mockCase.updateStageOutcome = vi.fn();
      update.mockResolvedValue(mockCase);

      await updateStageOutcomeUseCase(command);

      expect(findByCode).toHaveBeenCalledWith("specific-workflow-code");
    });
  });
});
