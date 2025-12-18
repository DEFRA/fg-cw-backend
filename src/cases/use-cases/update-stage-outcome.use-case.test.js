import Boom from "@hapi/boom";
import { describe, expect, it, vi } from "vitest";
import { withTransaction } from "../../common/with-transaction.js";
import { User } from "../../users/models/user.js";
import { Case } from "../models/case.js";
import { Position } from "../models/position.js";
import { Workflow } from "../models/workflow.js";
import { findById, update } from "../repositories/case.repository.js";
import { insertMany } from "../repositories/outbox.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";
import { updateStageOutcomeUseCase } from "./update-stage-outcome.use-case.js";

vi.mock("../../common/auth.js");
vi.mock("../repositories/case.repository.js");
vi.mock("../repositories/workflow.repository.js");
vi.mock("../publishers/case-event.publisher.js");
vi.mock("../repositories/outbox.repository.js");
vi.mock("../../common/with-transaction.js");

describe("updateStageOutcomeUseCase", () => {
  describe("successful stage outcome update", () => {
    it("updates stage outcome with comment", async () => {
      const session = {};
      withTransaction.mockImplementation(async (cb) => cb(session));
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();
      const mockUser = User.createMock();

      mockCase.currentStage = "STAGE_1";
      mockCase.caseRef = "CASE-123";

      const command = {
        caseId: mockCase._id,
        actionCode: "APPROVE",
        comment: "Application approved with conditions",
        user: mockUser,
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
        actionCode: "APPROVE",
        position: mockCase.position,
        comment: "Application approved with conditions",
      });
      expect(mockCase.updateStageOutcome).toHaveBeenCalledWith({
        workflow: mockWorkflow,
        actionCode: "APPROVE",
        comment: "Application approved with conditions",
        createdBy: mockUser.id,
      });
      expect(update).toHaveBeenCalledWith(mockCase, session);
    });

    it("updates stage outcome without comment", async () => {
      const session = {};
      withTransaction.mockImplementation(async (cb) => cb(session));
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();
      const mockUser = User.createMock();

      mockCase.currentStage = "STAGE_2";
      mockCase.caseRef = "CASE-456";

      const command = {
        caseId: mockCase._id,
        actionCode: "REJECT",
        comment: null,
        user: mockUser,
      };

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);
      mockWorkflow.validateStageActionComment = vi.fn();
      mockCase.updateStageOutcome = vi.fn();
      update.mockResolvedValue(mockCase);

      await updateStageOutcomeUseCase(command);

      expect(mockWorkflow.validateStageActionComment).toHaveBeenCalledWith({
        actionCode: "REJECT",
        position: mockCase.position,
        comment: null,
      });
      expect(mockCase.updateStageOutcome).toHaveBeenCalledWith({
        workflow: mockWorkflow,
        actionCode: "REJECT",
        comment: null,
        createdBy: mockUser.id,
      });
    });

    it("handles stage progression correctly", async () => {
      const session = {};
      withTransaction.mockImplementation(async (cb) => cb(session));
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();
      const mockUser = User.createMock();

      const previousStage = "STAGE_1";
      const newStage = "STAGE_2";

      mockCase.currentStage = previousStage;
      mockCase.caseRef = "CASE-789";

      const command = {
        caseId: mockCase._id,
        actionCode: "APPROVE",
        comment: "Moving to next stage",
        user: mockUser,
      };

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);
      mockWorkflow.validateStageActionComment = vi.fn();
      mockCase.updateStageOutcome = vi.fn(() => {
        mockCase.currentStage = newStage;
      });
      update.mockResolvedValue(mockCase);

      await updateStageOutcomeUseCase(command);
      expect(insertMany).toHaveBeenCalled();
    });

    it("uses authenticated user in stage outcome", async () => {
      const session = {};
      withTransaction.mockImplementation(async (cb) => cb(session));
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();
      const mockUser = User.createMock();

      const command = {
        caseId: mockCase._id,
        actionCode: "APPROVE",
        comment: "Test comment",
        user: mockUser,
      };

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);
      mockWorkflow.validateStageActionComment = vi.fn();
      mockCase.updateStageOutcome = vi.fn();
      update.mockResolvedValue(mockCase);

      await updateStageOutcomeUseCase(command);

      expect(mockCase.updateStageOutcome).toHaveBeenCalledWith({
        workflow: mockWorkflow,
        actionCode: "APPROVE",
        comment: "Test comment",
        createdBy: mockUser.id,
      });
    });
  });

  describe("error handling", () => {
    it("throws NotFound error when case is not found", async () => {
      const session = {};
      withTransaction.mockImplementation(async (cb) => cb(session));
      const command = {
        caseId: "non-existent-case-id",
        actionCode: "APPROVE",
        comment: "Test comment",
        user: User.createMock(),
      };

      findById.mockResolvedValue(null);

      await expect(updateStageOutcomeUseCase(command)).rejects.toThrow(
        Boom.notFound('Case with id "non-existent-case-id" not found'),
      );

      expect(findById).toHaveBeenCalledWith("non-existent-case-id");
      expect(findByCode).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it("throws error when workflow validation fails", async () => {
      const session = {};
      withTransaction.mockImplementation(async (cb) => cb(session));
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();
      const mockUser = User.createMock();

      const command = {
        caseId: mockCase._id,
        actionCode: "APPROVE",
        comment: "",
        user: mockUser,
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
        actionCode: "APPROVE",
        position: mockCase.position,
        comment: "",
      });
      expect(update).not.toHaveBeenCalled();
    });

    it("throws error when case update fails", async () => {
      const session = {};
      withTransaction.mockImplementation(async (cb) => cb(session));
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();
      const mockUser = User.createMock();

      const command = {
        caseId: mockCase._id,
        actionCode: "APPROVE",
        comment: "Test comment",
        user: mockUser,
      };

      const updateError = new Error("Database update failed");

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);
      mockWorkflow.validateStageActionComment = vi.fn();
      mockCase.updateStageOutcome = vi.fn();
      update.mockRejectedValue(updateError);

      await expect(() => updateStageOutcomeUseCase(command)).rejects.toThrow(
        updateError,
      );

      expect(update).toHaveBeenCalledWith(mockCase, session);
    });

    it("throws error when publishing fails", async () => {
      const session = {};
      withTransaction.mockImplementation(async (cb) => cb(session));
      insertMany.mockRejectedValue(false);
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();
      const mockUser = User.createMock();

      const command = {
        caseId: mockCase._id,
        actionCode: "APPROVE",
        comment: "Test comment",
        user: mockUser,
      };

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);
      mockWorkflow.validateStageActionComment = vi.fn();
      mockCase.updateStageOutcome = vi.fn();
      update.mockResolvedValue(mockCase);

      await expect(() => updateStageOutcomeUseCase(command)).rejects.toThrow();
    });

    it("throws error when updateStageOutcome on case fails", async () => {
      const session = {};
      withTransaction.mockImplementation(async (cb) => cb(session));
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();
      const mockUser = User.createMock();

      const command = {
        caseId: mockCase._id,
        actionCode: "APPROVE",
        comment: "Test comment",
        user: mockUser,
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
    });
  });

  describe("workflow integration", () => {
    it("validates stage action comment with correct parameters", async () => {
      const session = {};
      withTransaction.mockImplementation(async (cb) => cb(session));
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();
      const mockUser = User.createMock();

      mockCase.currentStage = "SPECIFIC_STAGE_CODE";

      const command = {
        caseId: mockCase._id,
        actionCode: "specific-action",
        comment: "specific comment text",
        user: mockUser,
      };

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);
      mockWorkflow.validateStageActionComment = vi.fn();
      mockCase.updateStageOutcome = vi.fn();
      update.mockResolvedValue(mockCase);

      await updateStageOutcomeUseCase(command);

      expect(mockWorkflow.validateStageActionComment).toHaveBeenCalledWith({
        actionCode: "specific-action",
        position: new Position({
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        }),
        comment: "specific comment text",
      });
    });

    it("finds workflow by case workflow code", async () => {
      const session = {};
      withTransaction.mockImplementation(async (cb) => cb(session));
      const mockCase = Case.createMock();
      const mockWorkflow = Workflow.createMock();
      const mockUser = User.createMock();

      mockCase.workflowCode = "specific-workflow-code";

      const command = {
        caseId: mockCase._id,
        actionCode: "APPROVE",
        comment: "Test comment",
        user: mockUser,
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
