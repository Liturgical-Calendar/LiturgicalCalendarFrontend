
/**
 * Generate a modal for removing a diocesan calendar.
 * @param {string} diocese The name of the diocese being removed.
 * @param {Object} messages A dictionary of localized strings.
 * @returns {string} A bootstrap modal div string.
 */
const removeDiocesanCalendarModal = (diocese, messages) => `
<div class="modal fade" id="removeDiocesanCalendarPrompt" tabindex="-1" role="dialog" aria-labelledby="removeDiocesanCalendarModalLabel" aria-hidden="true">
  <div class="modal-dialog" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="removeDiocesanCalendarModalLabel">${messages[ "Delete diocesan calendar" ]} ${diocese}?</h5>
      </div>
      <div class="modal-body">
        ${messages[ "If you choose" ]}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-backspace me-2"></i>Cancel</button>
        <button type="button" id="deleteDiocesanCalendarConfirm" class="btn btn-danger"><i class="far fa-trash-alt me-2"></i>Delete calendar</button>
      </div>
    </div>
  </div>
</div>`;

/**
 * Generate a modal for removing a diocesan calendar.
 * @param {string} calendar The id of the calenar being removed.
 * @param {Object} messages A dictionary of localized strings.
 * @returns {string} A bootstrap modal div string.
 */
const removeCalendarModal = (calendar, messages) => `
<div class="modal fade" id="removeCalendarDataPrompt" tabindex="-1" role="dialog" aria-labelledby="removeCalendarModalLabel" aria-hidden="true">
  <div class="modal-dialog" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="removeCalendarModalLabel">${messages[ "Delete calendar" ]} ${calendar}?</h5>
      </div>
      <div class="modal-body">
        ${messages[ "If you choose" ]}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-backspace me-2"></i>Cancel</button>
        <button type="button" id="deleteCalendarConfirm" class="btn btn-danger"><i class="far fa-trash-alt me-2"></i>Delete calendar</button>
      </div>
    </div>
  </div>
</div>`;


//kudos to https://stackoverflow.com/a/47140708/394921 for the idea
const sanitizeInput = (input) => {
    let doc = new DOMParser().parseFromString(input, 'text/html');
    return doc.body.textContent || "";
}


export {
    removeDiocesanCalendarModal,
    removeCalendarModal,
    sanitizeInput
}
