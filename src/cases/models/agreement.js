export const AgreementStatus = {
  Offered: "OFFERED",
  Accepted: "ACCEPTED",
  Rejected: "REJECTED",
  Withdrawn: "WITHDRAWN",
};

export class AgreementHistoryEntry {
  constructor({ agreementStatus, createdAt }) {
    this.agreementStatus = agreementStatus;
    this.createdAt = createdAt;
  }
}

export class Agreement {
  constructor({ agreementRef, latestStatus, updatedAt, history }) {
    this.agreementRef = agreementRef;
    this.latestStatus = latestStatus;
    this.updatedAt = updatedAt;
    this.history =
      history?.map(
        (item) =>
          new AgreementHistoryEntry({
            agreementStatus: item.agreementStatus,
            createdAt: item.createdAt,
          }),
      ) || [];
  }

  static new({ agreementRef, agreementStatus, date }) {
    const latestStatus = agreementStatus || AgreementStatus.Offered;

    return new Agreement({
      agreementRef,
      latestStatus,
      updatedAt: new Date().toISOString(),
      history: [
        new AgreementHistoryEntry({
          agreementStatus: latestStatus,
          createdAt: date,
        }),
      ],
    });
  }

  addHistoryEntry({ agreementStatus, createdAt }) {
    this.history.push(
      new AgreementHistoryEntry({ agreementStatus, createdAt }),
    );
    this.latestStatus = agreementStatus;
    this.updatedAt = new Date().toISOString();
  }
}

export const toAgreements = (data) => {
  const agreements = Object.keys(data).reduce((acc, agreementRef) => {
    const { latestStatus, updatedAt, history } = data[agreementRef];
    acc[agreementRef] = new Agreement({
      agreementRef,
      latestStatus,
      updatedAt,
      history,
    });
    return acc;
  }, {});

  return agreements;
};
