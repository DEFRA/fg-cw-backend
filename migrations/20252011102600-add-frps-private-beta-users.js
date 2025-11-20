export const up = async (db) => {
  const user = {
    name: "placeholder",
    email: "placeholder@rpa.gov.uk",
    idpRoles: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const roles = db.collection("roles");
  await roles.insertMany([
    {
      code: "ROLE_SFI_REFORM",
      description: "Case working role for SFI Reform",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      code: "ROLE_RPA_FINANCE",
      description: "Finance approval for RPA",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const appRoles = {
    ROLE_SFI_REFORM: {
      startDate: "2000-01-01",
      endDate: "2100-01-01",
    },
  };

  const caseWorkers = [
    { ...user, idpId: "44abd77b-6a38-435d-b6db-20f2a62a11d7", appRoles },
    { ...user, idpId: "ee77146b-e6ef-48e1-99b0-76b904903967", appRoles },
    { ...user, idpId: "eaa41543-7adf-4ff6-b4fa-9c241eaa5bb4", appRoles },
    { ...user, idpId: "56bf327c-a273-4b36-a99f-d0f2fab112b9", appRoles },
    { ...user, idpId: "0c3d197a-eb81-418c-b90d-297a2dfbcb81", appRoles },
    { ...user, idpId: "bf1f0e8d-7697-441c-9375-468c8037f596", appRoles },
    { ...user, idpId: "c8344480-6882-4d3e-bf86-32a56db75434", appRoles },
  ];

  const users = db.collection("users");
  await users.insertMany(caseWorkers);

  const financeRoles = {
    ROLE_RPA_FINANCE: {
      startDate: "2000-01-01",
      endDate: "2100-01-01",
    },
    ROLE_SFI_REFORM: {
      startDate: "2000-01-01",
      endDate: "2100-01-01",
    },
  };

  const financeUser = {
    ...user,
    idpId: "85b109aa-01bd-4219-8f68-d7771cf3e655",
    appRoles: financeRoles,
  };

  await users.insertOne(financeUser);

  const engineerRoles = {
    ROLE_SFI_REFORM: {
      startDate: "2000-01-01",
      endDate: "2100-01-01",
    },
    ROLE_RPA_FINANCE: {
      startDate: "2000-01-01",
      endDate: "2100-01-01",
    },
  };

  const engineers = [
    {
      ...user,
      idpId: "d43f2819-372a-4f09-a687-45fbba603f45",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "4def582d-e319-4a18-9037-117e1294c11d",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "7e1cb908-6461-48fd-b01e-94a7988aa272",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "f1a43d8c-faa1-43e2-addb-bc16b10ed476",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "b8e2a9d3-cbfa-4ba2-91df-5c5c37b89c27",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "896c3589-fc95-4f6e-926f-28da08896977",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "5fcdbea3-8dc4-4f22-9afd-6492125737b8",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "3e3d77e2-f29a-43b1-99ea-6b559c220163",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "0dacca39-a133-478d-873e-fd92e18df582",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "16bd6644-2335-4ee1-86a1-e64711779c41",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "c82821a7-fac3-47a9-8393-324a579a74bd",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "64bb8c4b-d167-4fb5-b5ec-c70be5ebc67a",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "209dfe19-f7eb-4046-85ea-a81ea765290c",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "ab38fd7f-9ef4-443c-95d5-38350daa776d",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "74f3da6a-0533-4852-8410-bd947f1ce6ae",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "271e73c4-c864-4b17-b1be-68570d60c90a",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "c660359f-1012-4e4a-92cd-043df0f831a5",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "dbb37ef4-c078-4475-abea-77a1dd90f14e",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "b0d38267-1665-489d-9e9a-c3c722cbde0b",
      appRoles: engineerRoles,
    },
    {
      ...user,
      idpId: "9e8c5f2c-5f3b-47b2-8812-1d806663aa8b",
      appRoles: engineerRoles,
    },
  ];

  await users.insertMany(engineers);
};
