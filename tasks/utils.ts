import { DeploymentsExtension } from "hardhat-deploy/dist/types";

export async function getLSTAddress(deployments: DeploymentsExtension, lst: "QSD" | "QRT" | "QETH") {
  switch (lst) {
    case "QSD":
      return deployments.get("Qsd").then(contract => contract.address);
    case "QRT":
      return deployments.get("Qrt").then(contract => contract.address);
    case "QETH":
      return deployments.get("Qeth").then(contract => contract.address);
  }
}