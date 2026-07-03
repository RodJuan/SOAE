/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SimulationConfig, SimulationResult, ResourceInventory, PrescriptionItem } from '../types';

/**
 * Predictive Engine for High-Scale Stress Testing.
 * Uses inverse optimization to calculate the exact resource matrix required to
 * achieve a >99% survival rate under catastrophic scenarios.
 */
export function runPredictiveStressTest(
  config: SimulationConfig,
  currentInventory: ResourceInventory
): SimulationResult {
  const { type, magnitude, radius, populationAffected } = config;

  // 1. Calculate projected casualties and incident vectors
  // Scale factor based on magnitude (1-10)
  const severityScale = Math.pow(magnitude / 5, 2); 
  const incidentRate = 0.002 * severityScale; // base rate of incidents per person
  
  let projectedIncidents = Math.round(populationAffected * incidentRate);
  if (projectedIncidents < 5) projectedIncidents = 5;

  // Distribute incident types based on disaster category
  let fireIncidents = 0;
  let landslideIncidents = 0;
  let medicalIncidents = 0;
  let chemicalIncidents = 0;

  switch (type) {
    case 'earthquake':
      fireIncidents = Math.round(projectedIncidents * 0.25);
      landslideIncidents = Math.round(projectedIncidents * 0.35);
      medicalIncidents = Math.round(projectedIncidents * 0.30);
      chemicalIncidents = Math.round(projectedIncidents * 0.10);
      break;
    case 'wildfire':
      fireIncidents = Math.round(projectedIncidents * 0.70);
      landslideIncidents = 0;
      medicalIncidents = Math.round(projectedIncidents * 0.20);
      chemicalIncidents = Math.round(projectedIncidents * 0.10);
      break;
    case 'chemical_spill':
      fireIncidents = Math.round(projectedIncidents * 0.15);
      landslideIncidents = 0;
      medicalIncidents = Math.round(projectedIncidents * 0.35);
      chemicalIncidents = Math.round(projectedIncidents * 0.50);
      break;
    case 'tsunami':
      fireIncidents = Math.round(projectedIncidents * 0.10);
      landslideIncidents = Math.round(projectedIncidents * 0.40);
      medicalIncidents = Math.round(projectedIncidents * 0.45);
      chemicalIncidents = Math.round(projectedIncidents * 0.05);
      break;
  }

  // Ensure total sum matches projectedIncidents
  projectedIncidents = fireIncidents + landslideIncidents + medicalIncidents + chemicalIncidents;

  // 2. Compute baseline survival rate with current fleet inventory
  // Each unit type can handle a certain number of concurrent incidents of its matching vector
  const capabilities = {
    fire_truck: currentInventory.fire_truck * 2, // 1 truck can cycle / manage 2 fire incidents in sequence
    heavy_rescue: currentInventory.heavy_rescue * 1.5,
    ambulance: currentInventory.ambulance * 3,
    hazmat: currentInventory.hazmat * 1,
  };

  // Calculate wait times / queue delays based on capacity deficit
  const calculateSurvivalAndDeficit = (testInventory: ResourceInventory) => {
    const capacities = {
      fire: testInventory.fire_truck * 2.5,
      landslide: testInventory.heavy_rescue * 1.5,
      medical: testInventory.ambulance * 3.5,
      chemical: testInventory.hazmat * 1.2,
    };

    const fireDeficitRatio = Math.max(0, (fireIncidents - capacities.fire) / (fireIncidents || 1));
    const landslideDeficitRatio = Math.max(0, (landslideIncidents - capacities.landslide) / (landslideIncidents || 1));
    const medicalDeficitRatio = Math.max(0, (medicalIncidents - capacities.medical) / (medicalIncidents || 1));
    const chemicalDeficitRatio = Math.max(0, (chemicalIncidents - capacities.chemical) / (chemicalIncidents || 1));

    // Weighted average deficit
    const weightedDeficit = (
      fireDeficitRatio * 0.3 +
      landslideDeficitRatio * 0.25 +
      medicalDeficitRatio * 0.25 +
      chemicalDeficitRatio * 0.2
    );

    // Exponential decay of survival based on overall response deficit and magnitude severity
    const lambda = 0.4 * (1 + magnitude / 10);
    const survivalRate = Math.max(10, Math.min(100, 100 * Math.exp(-lambda * weightedDeficit)));

    return {
      survivalRate,
      deficits: {
        fire_truck: Math.max(0, Math.ceil((fireIncidents / 2.5) - testInventory.fire_truck)),
        heavy_rescue: Math.max(0, Math.ceil((landslideIncidents / 1.5) - testInventory.heavy_rescue)),
        ambulance: Math.max(0, Math.ceil((medicalIncidents / 3.5) - testInventory.ambulance)),
        hazmat: Math.max(0, Math.ceil((chemicalIncidents / 1.2) - testInventory.hazmat)),
      }
    };
  };

  const baseline = calculateSurvivalAndDeficit(currentInventory);

  // 3. Inverse Optimization: Scale up resource matrix until survivalRate >= 99%
  const optimalInventory = { ...currentInventory };
  let currentSurvival = baseline.survivalRate;
  let iterations = 0;
  const maxIterations = 200;

  while (currentSurvival < 99.0 && iterations < maxIterations) {
    iterations++;
    const testResults = calculateSurvivalAndDeficit(optimalInventory);
    currentSurvival = testResults.survivalRate;

    if (currentSurvival >= 99.0) break;

    // Incrementally add resources where the deficit is largest
    if (testResults.deficits.fire_truck > 0) optimalInventory.fire_truck += 1;
    if (testResults.deficits.heavy_rescue > 0) optimalInventory.heavy_rescue += 1;
    if (testResults.deficits.ambulance > 0) optimalInventory.ambulance += 1;
    if (testResults.deficits.hazmat > 0) optimalInventory.hazmat += 1;

    // Safety fallback: if no specific deficits are identified but survival is still low, add across the board
    if (
      testResults.deficits.fire_truck === 0 &&
      testResults.deficits.heavy_rescue === 0 &&
      testResults.deficits.ambulance === 0 &&
      testResults.deficits.hazmat === 0
    ) {
      optimalInventory.fire_truck += 1;
      optimalInventory.heavy_rescue += 1;
      optimalInventory.ambulance += 1;
      optimalInventory.hazmat += 1;
    }
  }

  // Final confirmation of deficits to display
  const addedResources = {
    fire_truck: optimalInventory.fire_truck - currentInventory.fire_truck,
    heavy_rescue: optimalInventory.heavy_rescue - currentInventory.heavy_rescue,
    ambulance: optimalInventory.ambulance - currentInventory.ambulance,
    hazmat: optimalInventory.hazmat - currentInventory.hazmat,
  };

  // 4. Prescribe inventory based on disaster type and magnitude
  const prescription: PrescriptionItem[] = [];
  const addPrescription = (item: string, baseMultiplier: number, factor: number) => {
    const required = Math.round(populationAffected * baseMultiplier * factor * (magnitude / 5));
    if (required > 0) {
      // simulate some current inventory
      const current = Math.round(required * 0.4);
      const deficit = required - current;
      const priority = deficit > 100 ? 'high' : deficit > 30 ? 'medium' : 'low';
      prescription.push({ item, required, current, deficit, priority });
    }
  };

  if (type === 'earthquake') {
    addPrescription('Kits de Trauma Avanzado', 0.005, 1.2);
    addPrescription('Unidades de Oxígeno Portátil', 0.003, 1.0);
    addPrescription('Generadores de Energía de Campaña', 0.0002, 1.5);
    addPrescription('Puntos de Agua Potabilizada Móviles', 0.001, 1.8);
    addPrescription('Sistemas de Comunicación Satelital (Comms-On-The-Move)', 0.00005, 2.0);
  } else if (type === 'wildfire') {
    addPrescription('Equipos de Respiración Autónoma (ERA)', 0.004, 1.5);
    addPrescription('Cápsulas de Emulsión Retardante de Fuego', 0.002, 2.0);
    addPrescription('Kits de Quemaduras de Segundo/Tercer Grado', 0.003, 1.0);
    addPrescription('Drones de Reconocimiento Térmico FLIR', 0.0001, 1.8);
  } else if (type === 'chemical_spill') {
    addPrescription('Trajes de Protección Química Nivel A (Hazmat)', 0.002, 2.5);
    addPrescription('Duchas de Descontaminación Portátiles', 0.0001, 2.0);
    addPrescription('Kits de Absorción y Neutralizadores Químicos', 0.005, 1.5);
    addPrescription('Detectores Multi-Gas PID de Alta Sensibilidad', 0.0005, 1.2);
  } else { // tsunami
    addPrescription('Botes de Rescate en Inundaciones Rápida', 0.0005, 2.0);
    addPrescription('Mantas Térmicas de Emergencia contra Hipotermia', 0.01, 1.1);
    addPrescription('Bombas de Achique Sumergibles de Alta Capacidad', 0.0002, 1.6);
    addPrescription('Dispositivos de Localización GPS Personal (PLB)', 0.002, 1.3);
  }

  // Calculate risk score (0 to 100)
  const calculatedRiskScore = Math.min(100, Math.round((magnitude * 8) + (radius * 1.5) + (projectedIncidents * 0.5)));
  const estimatedCasualties = Math.round(populationAffected * 0.0015 * Math.pow(magnitude / 4, 2.5) * (1 - (baseline.survivalRate / 100)));

  return {
    simulationId: `sim-${Date.now()}`,
    timestamp: Date.now(),
    config,
    calculatedRiskScore,
    estimatedCasualties,
    resourceDeficit: addedResources, // Resource gap needed to reach >99%
    inventoryPrescription: prescription,
    overallSurvivalRate: Math.round(baseline.survivalRate),
  };
}
