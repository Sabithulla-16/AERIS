"use client";

import { useState } from "react";

interface RescueControlProps {
  onDropPayload: () => Promise<any>;
  isLoading: boolean;
  successMessage: string | null;
  errorMessage: string | null;
  onClearFeedback: () => void;
  isBackendOnline: boolean;
}

export default function RescueControl({
  onDropPayload,
  isLoading,
  successMessage,
  errorMessage,
  onClearFeedback,
  isBackendOnline,
}: RescueControlProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleOpenConfirm = () => {
    if (isLoading) return;
    onClearFeedback();
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    setShowConfirmModal(false);
    try {
      await onDropPayload();
    } catch {
      // Error handled inside useAerisData hook
    }
  };

  const handleCancel = () => {
    setShowConfirmModal(false);
  };

  return (
    <div className="card rescue-card">
      <div className="card-header">
        <div>
          <span className="label">EMERGENCY ACTUATOR</span>
          <h2>Rescue Payload Control</h2>
        </div>

        <span className={isBackendOnline ? "live-badge" : "alert-badge"}>
          {isBackendOnline ? "SERVO READY" : "OFFLINE"}
        </span>
      </div>

      <div className="rescue-body">
        <p className="rescue-desc">
          Emergency release for life-support payload, medical kit, or emergency beacon via ESP32 servo actuator.
        </p>

        <div className="rescue-action-row">
          <button
            id="btn-drop-payload"
            type="button"
            className="btn-drop-payload"
            onClick={handleOpenConfirm}
            disabled={isLoading || !isBackendOnline}
          >
            {isLoading ? (
              <span className="btn-loading-text">
                <span className="spinner-inline" /> SENDING COMMAND...
              </span>
            ) : (
              <span>⚠️ DROP PAYLOAD</span>
            )}
          </button>
        </div>

        {/* Feedback Messages */}
        {successMessage && (
          <div className="rescue-feedback success">
            <span>✅ {successMessage}</span>
            <button type="button" onClick={onClearFeedback} className="btn-dismiss">
              ✕
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="rescue-feedback error">
            <span>❌ {errorMessage}</span>
            <button type="button" onClick={onClearFeedback} className="btn-dismiss">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <span className="modal-warning-icon">🚨</span>
              <h3>CONFIRM EMERGENCY PAYLOAD DROP</h3>
            </div>

            <div className="modal-body">
              <p>
                Are you sure you want to activate the <strong>physical rescue payload drop</strong>?
              </p>
              <p className="modal-subtext">
                This command will immediately instruct the ESP32 servo mechanism to release the emergency supplies.
              </p>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={handleCancel}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="btn-modal-confirm"
                onClick={handleConfirm}
              >
                CONFIRM DROP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
