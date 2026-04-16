/**
 * === AirIndex AQI Monitoring Application ===
 * Refactored for Performance, Maintainability & Best Practices
 */

// ============ CONFIGURATION ============
const CONFIG = {
  API_KEY: "36abb1d7a917d71bceb90af7d3ff6bf6", // ⚠️ Should be moved to server as env var
  API_URL: window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : '/api', // Works for production
  MODEL_CONFIG: {
    epochs: 60,
    batchSize: 32,
    verbose: 0
  },
  MAX_HISTORY: 10,
  DEBOUNCE_DELAY: 300,
  CONFIDENCE_THRESHOLD: 0.7
};

// ============ STATE MANAGEMENT ============
const AppState = {
  aqiHistory: [],
  cityHistory: [],
  currentCity: null,
  aiModel: null,
  isModelTrained: false,
  emoji: "😐",

  addAQI(city, aqi) {
    this.aqiHistory.push(aqi);
    this.cityHistory.push(city);
    
    // Keep only last N entries
    if (this.aqiHistory.length > CONFIG.MAX_HISTORY) {
      this.aqiHistory.shift();
      this.cityHistory.shift();
    }
  },

  reset() {
    this.aqiHistory = [];
    this.cityHistory = [];
    this.isModelTrained = false;
    this.cleanupModel();
  },

  cleanupModel() {
    if (this.aiModel) {
      this.aiModel.dispose();
      this.aiModel = null;
    }
  }
};

// ============ AQI UTILITIES ============
/**
 * Get detailed AQI information
 */
function getAQIInfo(aqi) {
  const ranges = [
    {
      max: 50,
      color: "#00e676",
      status: "Good",
      risk: "10%",
      desc: "Air quality is satisfactory",
      advice: "🌿 Safe to go outside and enjoy fresh air",
      emoji: "😄"
    },
    {
      max: 100,
      color: "#ffeb3b",
      status: "Moderate",
      risk: "35%",
      desc: "Moderate risk due to air quality",
      advice: "😐 Sensitive people should be careful outdoors",
      emoji: "🙂"
    },
    {
      max: 150,
      color: "#ff9800",
      status: "Unhealthy for Sensitive Groups",
      risk: "55%",
      desc: "Sensitive groups may be affected",
      advice: "😷 Reduce prolonged outdoor activities",
      emoji: "😷"
    },
    {
      max: 200,
      color: "#f44336",
      status: "Unhealthy",
      risk: "75%",
      desc: "Everyone may experience effects",
      advice: "🚫 Avoid outdoor activities, wear a mask",
      emoji: "🤒"
    },
    {
      max: 300,
      color: "#9c27b0",
      status: "Very Unhealthy",
      risk: "90%",
      desc: "Health alert conditions",
      advice: "😷 Stay indoors and use air purifier",
      emoji: "🤢"
    },
    {
      max: Infinity,
      color: "#880e4f",
      status: "Hazardous",
      risk: "100%",
      desc: "Emergency conditions",
      advice: "🚨 Emergency! Stay indoors, avoid all outdoor exposure",
      emoji: "☠️"
    }
  ];

  return ranges.find(r => aqi <= r.max);
}

/**
 * Update AQI display with color coding
 */
function updateAQIDisplay(aqiValue, info) {
  const updates = {
    mainAqi: aqiValue,
    aqiEmoji: info.emoji
  };

  Object.entries(updates).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });

  // Color styling
  const elements = [
    { id: "mainAqi", style: "color" },
    { id: "aqi-bar", style: "boxShadow", value: `0 0 25px ${info.color}` }
  ];

  elements.forEach(({ id, style, value }) => {
    const el = document.getElementById(id);
    if (el) {
      el.style[style] = value || info.color;
    }
  });

  // Update AQI bar fill
  const aqiFill = document.getElementById("aqiFill");
  if (aqiFill) {
    const percent = Math.min((aqiValue / 300) * 100, 100);
    aqiFill.style.left = percent + "%";
  }

  AppState.emoji = info.emoji;
}

/**
 * Calculate cigarette equivalent
 */
function getCigaretteEquivalent(pm25) {
  // Average cigarette PM2.5 ≈ 22 µg/m³
  return (pm25 / 22).toFixed(2);
}

// ============ AI/ML MODEL ============
/**
 * Improved TensorFlow.js model with proper cleanup
 */
class AQIPredictionModel {
  constructor() {
    this.model = null;
    this.isCompiled = false;
  }

  /**
   * Build model only once
   */
  buildModel() {
    if (this.model) return;

    console.log("🏗️ Building AQI prediction model...");
    
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({
          units: 16,
          activation: "relu",
          inputShape: [1]
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 8,
          activation: "relu"
        }),
        tf.layers.dense({
          units: 1,
          activation: "sigmoid"
        })
      ]
    });

    this.model.compile({
      optimizer: tf.train.adam(0.01),
      loss: "meanSquaredError",
      metrics: ["mae"]
    });

    this.isCompiled = true;
  }

  /**
   * Normalize data for model
   */
  normalizeData(data, min = 0, max = 300) {
    return data.map(v => (v - min) / (max - min));
  }

  /**
   * Train model with cleanup
   */
  async train(data) {
    if (data.length < 3) {
      console.warn("⚠️ Insufficient data for training");
      return null;
    }

    this.buildModel();

    try {
      const normalized = this.normalizeData(data);
      
      // Create training tensors
      const xs = tf.tensor2d(
        normalized.slice(0, -1).map(v => [v])
      );
      const ys = tf.tensor2d(
        normalized.slice(1).map(v => [v])
      );

      // Train
      await this.model.fit(xs, ys, {
        epochs: CONFIG.MODEL_CONFIG.epochs,
        batchSize: CONFIG.MODEL_CONFIG.batchSize,
        verbose: CONFIG.MODEL_CONFIG.verbose,
        shuffle: true
      });

      // Cleanup tensors
      xs.dispose();
      ys.dispose();

      AppState.isModelTrained = true;
      console.log("✅ Model trained successfully");
      return true;
    } catch (error) {
      console.error("❌ Model training error:", error);
      return null;
    }
  }

  /**
   * Predict next value
   */
  predict(lastValue) {
    if (!this.model || !AppState.isModelTrained) {
      return null;
    }

    try {
      const normalized = (lastValue - 0) / (300 - 0);
      const input = tf.tensor2d([[normalized]]);
      
      const prediction = this.model.predict(input);
      const result = prediction.dataSync()[0];
      
      // Cleanup
      input.dispose();
      prediction.dispose();

      const denormalized = Math.round(result * 300);
      const confidence = Math.min(result, 1 - result) * 2; // 0-1 scale

      return {
        value: Math.max(0, Math.min(500, denormalized)),
        confidence: confidence >= CONFIG.CONFIDENCE_THRESHOLD ? "High" : "Low"
      };
    } catch (error) {
      console.error("❌ Prediction error:", error);
      return null;
    }
  }

  /**
   * Predict next 7 days (returns array)
   */
  async predictNext7Days() {
    if (!AppState.aqiHistory.length) return [];

    try {
      const predictions = [];
      let currentValue = AppState.aqiHistory[AppState.aqiHistory.length - 1];

      for (let i = 0; i < 7; i++) {
        const pred = this.predict(currentValue);
        if (!pred) break;
        predictions.push(pred.value);
        currentValue = pred.value;
      }

      console.log("📈 7-day prediction:", predictions);
      return predictions;
    } catch (error) {
      console.error("❌ 7-day prediction error:", error);
      return [];
    }
  }

  /**
   * Cleanup and reset
   */
  dispose() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.isCompiled = false;
      AppState.isModelTrained = false;
    }
  }
}

const aiModel = new AQIPredictionModel();

// ============ CHART MANAGEMENT ============
let chart = null;

/**
 * Initialize Chart.js with proper styling
 */
function initChart() {
  const ctx = document.getElementById("aqiChart");
  if (!ctx) return;

  if (chart) chart.destroy();

  chart = new Chart(ctx.getContext("2d"), {
    type: "line",
    data: {
      labels: AppState.cityHistory.length ? AppState.cityHistory : ["No Data"],
      datasets: [
        {
          label: "Historical AQI",
          data: AppState.aqiHistory,
          borderColor: "#5b9cf5",
          backgroundColor: "rgba(91, 156, 245, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: "#5b9cf5",
          pointBorderColor: "white",
          pointBorderWidth: 2,
          pointHoverRadius: 7
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: {
            color: "rgba(255, 255, 255, 0.8)",
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          titleColor: "white",
          bodyColor: "white",
          borderColor: "#5b9cf5",
          borderWidth: 1,
          padding: 10,
          displayColors: true,
          callbacks: {
            label: function(context) {
              return `AQI: ${context.parsed.y}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: "rgba(255, 255, 255, 0.6)",
            font: { size: 10 }
          },
          grid: {
            color: "rgba(255, 255, 255, 0.1)"
          }
        },
        y: {
          beginAtZero: true,
          max: 300,
          ticks: {
            color: "rgba(255, 255, 255, 0.6)",
            font: { size: 10 }
          },
          grid: {
            color: "rgba(255, 255, 255, 0.1)"
          }
        }
      }
    }
  });
}

/**
 * Update chart with new data and predictions
 */
async function updateChart() {
  if (!chart) {
    initChart();
    return;
  }

  chart.data.labels = AppState.cityHistory;
  chart.data.datasets[0].data = AppState.aqiHistory;

  // Add predicted data if available
  const predictions = await aiModel.predictNext7Days();
  
  // Remove old prediction dataset if exists
  chart.data.datasets = chart.data.datasets.filter(d => d.label !== "7-Day Prediction");

  if (predictions.length > 0) {
    const predictionLabels = Array(AppState.aqiHistory.length - 1)
      .fill(null)
      .concat(predictions);

    chart.data.datasets.push({
      label: "7-Day Prediction",
      data: predictionLabels,
      borderColor: "#a855f7",
      borderDash: [7, 5],
      borderWidth: 2,
      fill: false,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: "#a855f7",
      pointBorderColor: "white",
      pointBorderWidth: 1,
      pointStyle: "circle",
      spanGaps: true
    });
  }

  chart.update();
}

// ============ API & DATA FETCHING ============
/**
 * Debounce utility for search
 */
function debounce(func, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

/**
 * Fetch AQI data from OpenWeatherMap API
 */
async function fetchAQI(city) {
  const loadingEl = document.getElementById("loading");
  if (loadingEl) {
    loadingEl.innerHTML = '<i class="fas fa-spinner fa-spin fa-2x"></i><p>Loading...</p>';
    loadingEl.style.display = "block";
  }

  try {
    // Input validation
    if (!city || typeof city !== 'string' || city.trim().length < 2) {
      showError("Please enter a valid city name");
      return;
    }

    const encodedCity = encodeURIComponent(city.trim());

    // 1. Get coordinates
    console.log(`🔍 Searching for: ${city}`);
    const geoRes = await fetchWithTimeout(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodedCity}&limit=1&appid=${CONFIG.API_KEY}`,
      5000
    );

    if (!geoRes.ok) throw new Error("City not found");

    const geoData = await geoRes.json();

    if (!geoData || geoData.length === 0) {
      showError("City not found. Please check the spelling.");
      return;
    }

    const { lat, lon, name: cityName, country } = geoData[0];
    const fullCity = `${cityName}, ${country}`;

    // 2. Get AQI data
    console.log(`📍 Fetching AQI for: ${fullCity} (${lat}, ${lon})`);
    const aqiRes = await fetchWithTimeout(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}`,
      5000
    );

    if (!aqiRes.ok) throw new Error("Failed to fetch AQI data");

    const aqiData = await aqiRes.json();

    // 3. Save to backend
    await saveAQIData(fullCity, aqiData);

    // 4. Update UI
    processAQIData(aqiData, fullCity);

  } catch (error) {
    console.error("❌ Fetch error:", error);
    showError(error.message || "Failed to fetch data. Please try again.");
  } finally {
    if (loadingEl) {
      loadingEl.style.display = "none";
    }
  }
}

/**
 * Fetch with timeout
 */
function fetchWithTimeout(url, timeout = 5000) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeout)
    )
  ]);
}

/**
 * Save AQI data to backend
 */
async function saveAQIData(city, aqiData) {
  try {
    const components = aqiData.list[0].components;
    
    const payload = {
      city,
      aqi: Math.round(aqiData.list[0].main.aqi * 48),
      pm25: components.pm2_5 || 0,
      pm10: components.pm10 || 0,
      o3: components.o3 || 0
    };

    const response = await fetch(`${CONFIG.API_URL}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.warn("⚠️ Failed to save to backend");
    } else {
      console.log("✅ Data saved to backend");
    }
  } catch (error) {
    console.warn("⚠️ Backend save error:", error.message);
    // Non-critical, don't block user
  }
}

/**
 * Process and display AQI data
 */
async function processAQIData(aqiData, cityName) {
  try {
    const rawAQI = aqiData.list[0].main.aqi * 48;
    const aqi = Math.round(rawAQI);
    const components = aqiData.list[0].components;

    const info = getAQIInfo(aqi);

    // Update display
    updateAQIDisplay(aqi, info);

    // Update location
    const locationEl = document.getElementById("location");
    if (locationEl) locationEl.textContent = cityName.split(",")[0];

    // Find dominant pollutant
    const pollutants = [
      { name: "PM2.5", value: components.pm2_5 || 0 },
      { name: "PM10", value: components.pm10 || 0 },
      { name: "O₃", value: components.o3 || 0 },
      { name: "NO₂", value: components.no2 || 0 },
      { name: "SO₂", value: components.so2 || 0 }
    ];

    const dominant = pollutants.reduce((max, p) =>
      p.value > max.value ? p : max
    );

    // Update pollutant display
    const pollutantEl = document.getElementById("pollutant");
    if (pollutantEl) pollutantEl.textContent = dominant.name;

    // Update Risk of Pollution section
    const riskEl = document.getElementById("risk");
    const riskDescEl = document.getElementById("riskDesc");
    if (riskEl) riskEl.textContent = info.risk;
    if (riskDescEl) riskDescEl.textContent = info.desc;

    // Update Risk Details
    const riskDetailsEl = document.getElementById("riskDetails");
    if (riskDetailsEl) {
      riskDetailsEl.innerHTML = `
        <strong>Pollutant Breakdown:</strong><br>
        PM2.5: ${(components.pm2_5 || 0).toFixed(1)} µg/m³<br>
        PM10: ${(components.pm10 || 0).toFixed(1)} µg/m³<br>
        O₃: ${(components.o3 || 0).toFixed(1)} µg/m³<br>
        NO₂: ${(components.no2 || 0).toFixed(1)} µg/m³<br>
        SO₂: ${(components.so2 || 0).toFixed(1)} µg/m³<br>
        <strong>Status:</strong> ${info.status}
      `;
    }

    // Update Health Advisory
    const adviceEl = document.getElementById("adviceText");
    if (adviceEl) adviceEl.textContent = info.advice;

    // Update Advisory Details
    const advisoryDetailsEl = document.getElementById("advisoryDetails");
    if (advisoryDetailsEl) {
      advisoryDetailsEl.innerHTML = `
        <strong>Health Recommendation:</strong><br>
        ${info.advice}<br><br>
        <strong>Risk Level:</strong> ${info.risk}<br>
        <strong>Status:</strong> ${info.status}<br>
        <strong>Precautions:</strong> ${getPrecautions(aqi)}
      `;
    }

    // Cigarette equivalent
    const cigarettes = getCigaretteEquivalent(components.pm2_5 || 0);
    const cigarEl = document.getElementById("cigaretteText");
    if (cigarEl) {
      cigarEl.textContent = `🚬 Equivalent to ${cigarettes} cigarettes/day`;
    }

    // Update insights panel with detailed pollutant data
    const pm25El = document.getElementById("pm25Value");
    const pm10El = document.getElementById("pm10Value");
    const o3El = document.getElementById("o3Value");
    const no2El = document.getElementById("no2Value");
    const so2El = document.getElementById("so2Value");
    const coEl = document.getElementById("coValue");
    const dominantEl = document.getElementById("dominantPollutant");
    const healthEl = document.getElementById("healthImpact");
    const recEl = document.getElementById("recommendation");

    if (pm25El) pm25El.textContent = (components.pm2_5 || 0).toFixed(1);
    if (pm10El) pm10El.textContent = (components.pm10 || 0).toFixed(1);
    if (o3El) o3El.textContent = (components.o3 || 0).toFixed(1);
    if (no2El) no2El.textContent = (components.no2 || 0).toFixed(1);
    if (so2El) so2El.textContent = (components.so2 || 0).toFixed(1);
    if (coEl) coEl.textContent = (components.co || 0).toFixed(1);
    if (dominantEl) dominantEl.textContent = dominant.name;
    if (healthEl) healthEl.textContent = info.status;
    if (recEl) recEl.textContent = info.emoji;

    // Add to history
    AppState.addAQI(cityName, aqi);
    AppState.currentCity = cityName;

    // Train model and update chart
    await aiModel.train(AppState.aqiHistory);
    await updateChart();

    // Show AI prediction
    if (AppState.isModelTrained) {
      const nextPred = aiModel.predict(aqi);
      if (nextPred) {
        const predEl = document.getElementById("predictionText");
        if (predEl) {
          predEl.innerHTML = `🤖 Next AQI: <strong>${nextPred.value}</strong> 
            (${nextPred.confidence} Confidence)`;
        }
      }
    }

    showSuccess(`Updated: ${cityName} - AQI ${aqi}`);

  } catch (error) {
    console.error("❌ Processing error:", error);
    showError("Failed to process AQI data");
  }
}

/**
 * Get health precautions based on AQI
 */
function getPrecautions(aqi) {
  if (aqi <= 50) return "None needed - air quality is good";
  if (aqi <= 100) return "Sensitive individuals should limit outdoor activities";
  if (aqi <= 150) return "Reduce outdoor activities; use air purifier indoors";
  if (aqi <= 200) return "Avoid outdoor exposure; wear N95 mask if going outside";
  if (aqi <= 300) return "Stay indoors; use air purifier; wear respirator outdoors";
  return "Emergency - evacuate to clean air area immediately";
}

// ============ UI UTILITIES ============
/**
 * Show error message
 */
function showError(message) {
  console.error("❌ Error:", message);
  
  const errorEl = document.getElementById("error-message");
  if (errorEl) {
    errorEl.textContent = `❌ ${message}`;
    errorEl.style.display = "block";
    setTimeout(() => {
      errorEl.style.display = "none";
    }, 5000);
  }
}

/**
 * Show success message
 */
function showSuccess(message) {
  console.log("✅", message);
  
  const successEl = document.getElementById("success-message");
  if (successEl) {
    successEl.textContent = `✅ ${message}`;
    successEl.style.display = "block";
    setTimeout(() => {
      successEl.style.display = "none";
    }, 3000);
  }
}

// ============ DATE & TIME ============
function updateDateTime() {
  const now = new Date();
  const dateEl = document.getElementById("datetime");
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

/**
 * Update time every second
 */
function startTimeUpdater() {
  updateDateTime();
  setInterval(updateDateTime, 1000);
}

// ============ EVENT LISTENERS ============
function initEventListeners() {
  // Search functionality
  const searchInput = document.getElementById("citySearch");
  const searchBtn = document.getElementById("searchButton");

  if (searchInput && searchBtn) {
    const debouncedSearch = debounce((city) => {
      if (city && city.trim().length > 0) {
        fetchAQI(city);
      }
    }, CONFIG.DEBOUNCE_DELAY);

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const city = searchInput.value.trim();
        if (city) {
          fetchAQI(city);
          searchInput.value = "";
        }
      }
    });

    searchBtn.addEventListener("click", () => {
      const city = searchInput.value.trim();
      if (city) {
        fetchAQI(city);
        searchInput.value = "";
      }
    });
  }

  // Details button handlers
  const riskDetailsBtn = document.getElementById("riskDetailsBtn");
  const riskDetailsEl = document.getElementById("riskDetails");
  if (riskDetailsBtn && riskDetailsEl) {
    riskDetailsBtn.addEventListener("click", () => {
      const isHidden = riskDetailsEl.style.display === "none";
      riskDetailsEl.style.display = isHidden ? "block" : "none";
      riskDetailsBtn.textContent = isHidden ? "Hide" : "Details";
    });
  }

  const advisoryDetailsBtn = document.getElementById("advisoryDetailsBtn");
  const advisoryDetailsEl = document.getElementById("advisoryDetails");
  if (advisoryDetailsBtn && advisoryDetailsEl) {
    advisoryDetailsBtn.addEventListener("click", () => {
      const isHidden = advisoryDetailsEl.style.display === "none";
      advisoryDetailsEl.style.display = isHidden ? "block" : "none";
      advisoryDetailsBtn.textContent = isHidden ? "Hide" : "Details";
    });
  }

  // Get Started button
  const getStartedBtn = document.querySelector(".btn-primary");
  if (getStartedBtn) {
    getStartedBtn.addEventListener("click", () => {
      showSuccess("Welcome to AirIndex! Search for a city to get started.");
    });
  }

  // About Modal handlers
  const aboutBtn = document.getElementById("aboutBtn");
  const aboutModal = document.getElementById("aboutModal");
  const modalClose = document.querySelector(".modal-close");
  const modalOverlay = document.querySelector(".modal-overlay");

  if (aboutBtn && aboutModal) {
    aboutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      aboutModal.classList.add("active");
      aboutModal.setAttribute("aria-hidden", "false");
    });
  }

  // Air Quality Modal handlers
  const airQualityBtn = document.getElementById("airQualityBtn");
  const airQualityModal = document.getElementById("airQualityModal");

  if (airQualityBtn && airQualityModal) {
    airQualityBtn.addEventListener("click", (e) => {
      e.preventDefault();
      airQualityModal.classList.add("active");
      airQualityModal.setAttribute("aria-hidden", "false");
    });
  }

  // Monitors Modal handlers
  const monitorsBtn = document.getElementById("monitorsBtn");
  const monitorsModal = document.getElementById("monitorsModal");

  if (monitorsBtn && monitorsModal) {
    monitorsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      monitorsModal.classList.add("active");
      monitorsModal.setAttribute("aria-hidden", "false");
    });
  }

  // Close modal handlers (works for all modals)
  const closeButtons = document.querySelectorAll(".modal-close");
  const overlays = document.querySelectorAll(".modal-overlay");

  closeButtons.forEach(button => {
    button.addEventListener("click", () => {
      const modal = button.closest(".modal");
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
    });
  });

  overlays.forEach(overlay => {
    overlay.addEventListener("click", () => {
      const modal = overlay.closest(".modal");
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
    });
  });

  // Close modal on Escape key
  if (aboutModal) {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && aboutModal.classList.contains("active")) {
        aboutModal.classList.remove("active");
        aboutModal.setAttribute("aria-hidden", "true");
      }
    });
  }
}

// ============ INITIALIZATION ============
window.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Initializing AirIndex Application...");

  try {
    // Initialize components
    startTimeUpdater();
    initChart();
    initEventListeners();

    // Load default city
    console.log("📍 Loading default city: Hyderabad");
    fetchAQI("Hyderabad");

  } catch (error) {
    console.error("❌ Initialization error:", error);
    showError("Failed to initialize application");
  }
});

// ============ CLEANUP ============
window.addEventListener("beforeunload", () => {
  aiModel.dispose();
  if (chart) chart.destroy();
});
