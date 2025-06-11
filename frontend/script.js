const API_BASE = 'https://dailytarget-112.onrender.com/api';
const container = document.getElementById('timeSlotsContainer');
const saveBtn = document.getElementById('saveBtn');
const historyContainer = document.getElementById('historyContainer');
const dateInput = document.getElementById('datePicker');
const prevDayBtn = document.getElementById('prevDayBtn');
const nextDayBtn = document.getElementById('nextDayBtn');
let weeklyChartInstance = null;
let monthlyChartInstance = null;

dateInput.addEventListener('change', loadSlots);
saveBtn.addEventListener('click', saveActivities);
prevDayBtn.addEventListener('click', () => changeDateBy(-1));
nextDayBtn.addEventListener('click', () => changeDateBy(1));

function generateSlots() {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      let start = formatTime(h, m);
      let end = formatTime(h, m + 30);
      slots.push({ startTime: start, endTime: end, activity: '', category: 'Neutral' });
    }
  }
  return slots;
}

function formatTime(hours, minutes) {
  let adjustedHours = hours;
  let adjustedMinutes = minutes;
  if (adjustedMinutes >= 60) {
    adjustedMinutes -= 60;
    adjustedHours += 1;
  }

  const ampm = adjustedHours >= 12 ? 'PM' : 'AM';
  const hr = adjustedHours % 12 || 12;
  const min = adjustedMinutes.toString().padStart(2, '0');
  return `${hr}:${min} ${ampm}`;
}

let chartInstance;

async function loadSlots() {
  container.innerHTML = '';
  const date = dateInput.value;
  if (!date) {
    console.warn("No date selected.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/activities/${date}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    const slots = data.timeSlots.length > 0 ? data.timeSlots : generateSlots();

    const grid = document.createElement('div');
    grid.className = 'slots-grid';

    slots.forEach(slot => {
      const div = document.createElement('div');
      div.innerHTML = `
        <div class="time-display">${slot.startTime} - ${slot.endTime}</div>
        <input type="text" placeholder="Activity" value="${slot.activity}" class="activity"/>
        <select class="category">
          <option value="Productive"${slot.category === 'Productive' ? ' selected' : ''}>Productive</option>
          <option value="Neutral"${slot.category === 'Neutral' ? ' selected' : ''}>Neutral</option>
          <option value="Waste"${slot.category === 'Waste' ? ' selected' : ''}>Waste</option>
        </select>
      `;
      grid.appendChild(div);
    });

    container.appendChild(grid);
    showPieChart(slots);
  } catch (err) {
    console.error("Error loading slots:", err);
    alert('Failed to load activities for this date.');
  }
}


function showPieChart(slots) {
  const counts = { Productive: 0, Neutral: 0, Waste: 0 };
  const MINUTES_PER_SLOT = 30;

  slots.forEach(slot => {
    if (counts.hasOwnProperty(slot.category)) {
      counts[slot.category] += MINUTES_PER_SLOT;
    }
  });

  const data = {
    labels: ['Productive', 'Neutral', 'Waste'],
    datasets: [{
      data: [counts.Productive, counts.Neutral, counts.Waste],
      backgroundColor: ['#28a745', '#4169E1', '#dc3545'],
      borderColor: '#ffffff',
      borderWidth: 2
    }]
  };

  const config = {
    type: 'pie',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { size: 14, family: 'Segoe UI' },
            padding: 20
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || '';
              const value = context.raw;
              return `${label}: ${value} minutes`;
            }
          }
        }
      }
    }
  };

  const ctx = document.getElementById('activityChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, config);
}

async function saveActivities() {
    const date = dateInput.value;
    if (!date) {
        alert('Please select a date first to save activities.');
        return;
    }

    saveBtn.disabled = true; // Save button ko disable kar do saving ke dauran

    // Ab hum .slots-grid ke andar ke har div ko select kar rahe hain
    const divs = container.querySelectorAll('.slots-grid > div');
    const timeSlots = [];

    divs.forEach(div => {
        const timeText = div.querySelector('.time-display')?.innerText || '';
        const [start, end] = timeText.split(' - ');
        const activity = div.querySelector('.activity')?.value.trim() || '';
        const category = div.querySelector('.category')?.value || 'Neutral';

        // ✅ Yahan badlav kiya gaya hai:
        // Ab hum sirf yeh check kar rahe hain ki startTime aur endTime valid hain ya nahi.
        // Agar valid hain, toh us slot ko timeSlots array mein push kar denge,
        // bhale hi activity empty ho ya category 'Neutral' ho.
        if (start && end) {
            timeSlots.push({ startTime: start, endTime: end, activity, category });
        }
    });

    try {
        const res = await fetch(`${API_BASE}/activities`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, timeSlots })
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'Unknown server error' }));
            throw new Error(errorData.message || `Server error occurred during saving (Status: ${res.status}).`);
        }

        alert('Activities saved successfully!');
        loadHistory(); // Activities save hone ke baad history ko reload karo
    } catch (err) {
        console.error('Error saving activities:', err);
        alert(`Failed to save activities: ${err.message}`);
    } finally {
        saveBtn.disabled = false; // Saving complete hone ke baad button ko enable karo
    }
}


function changeDateBy(days) {
  const current = new Date(dateInput.value);
  current.setDate(current.getDate() + days);
  const newDate = current.toISOString().split('T')[0];
  dateInput.value = newDate;
  loadSlots();
  loadHistory();
}

async function loadHistory() {
  try {
    const res = await fetch(`${API_BASE}/activities/history`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: 'Unknown server error' }));
      throw new Error(`HTTP error! status: ${res.status}, Message: ${errorData.message || 'Server responded with an error.'}`);
    }
    const history = await res.json();

    historyContainer.innerHTML = '';

    if (!Array.isArray(history) || history.length === 0) {
      historyContainer.innerHTML = '<p class="info-message">No history available. Start tracking your activities!</p>';
      return;
    }

    history.forEach(day => {
      const div = document.createElement('div');
      div.innerHTML = `
        <strong>${day.date}</strong><br/>
        <span style="color: #28a745;">✅ Productive: ${day.productive} mins</span><br/>
        <span style="color: #007bff;">🟡 Neutral: ${day.neutral} mins</span><br/>
        <span style="color: #dc3545;">❌ Waste: ${day.waste} mins</span><br/>
        <span>📅 Entries: ${day.totalSlots}</span>
      `;
      historyContainer.appendChild(div);
    });

    updateWeeklyChart(history);
    updateMonthlyChart(history);
  } catch (err) {
    console.error("Error loading history:", err);
    historyContainer.innerHTML = `<p style="color: #dc3545; font-weight: bold;">Failed to load history: ${err.message}</p>`;
  }
}

function updateWeeklyChart(history) {
  const last7 = history.slice(-7);
  const total = { Productive: 0, Neutral: 0, Waste: 0 };

  last7.forEach(day => {
    total.Productive += day.productive;
    total.Neutral += day.neutral;
    total.Waste += day.waste;
  });

  const data = {
    labels: ['Productive', 'Neutral', 'Waste'],
    datasets: [{
      data: [total.Productive, total.Neutral, total.Waste],
      backgroundColor: ['#28a745', '#4169E1', '#dc3545'],
      borderColor: '#ffffff',
      borderWidth: 2
    }]
  };

  if (weeklyChartInstance) weeklyChartInstance.destroy();
  weeklyChartInstance = new Chart(document.getElementById('weeklyChart'), {
    type: 'pie',
    data: data,
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function updateMonthlyChart(history) {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const thisMonth = history.filter(day => {
    const date = new Date(day.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const total = { Productive: 0, Neutral: 0, Waste: 0 };

  thisMonth.forEach(day => {
    total.Productive += day.productive;
    total.Neutral += day.neutral;
    total.Waste += day.waste;
  });

  const data = {
    labels: ['Productive', 'Neutral', 'Waste'],
    datasets: [{
      data: [total.Productive, total.Neutral, total.Waste],
      backgroundColor: ['#28a745', '#4169E1', '#dc3545'],
      borderColor: '#ffffff',
      borderWidth: 2
    }]
  };

  if (monthlyChartInstance) monthlyChartInstance.destroy();
  monthlyChartInstance = new Chart(document.getElementById('monthlyChart'), {
    type: 'pie',
    data: data,
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;
  loadSlots();
  loadHistory();
});
