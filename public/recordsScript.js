document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('searchBtn');
  const clearBtn = document.getElementById('clearBtn');
  const searchInput = document.getElementById('searchInput');
  const searchType = document.getElementById('searchType');
  const recordsContainer = document.getElementById('recordsContainer');

  // Load all records on page load
  loadRecords();

  // Load records (all or filtered)
  async function loadRecords(searchType = '', searchValue = '') {
    try {
      let url = 'http://localhost:5000/api/records/search';
      if (searchValue) {
        url += `?type=${searchType}&value=${encodeURIComponent(searchValue)}`;
      }

      const response = await fetch(url);
      const records = await response.json();

      if (records.length === 0) {
        recordsContainer.innerHTML = '<div class="no-records">No records found</div>';
        return;
      }

      recordsContainer.innerHTML = records.map(record => `
          <div class="record-card" data-id="${record._id}">
            <img src="${record.pic}" alt="${record.name}" class="record-img">
            <div class="record-info">
              <h3> ${record.name}</h3>
              <p>Reg No: ${record.regno}</p>
              <button class="delete-btn" onclick="deleteRecord('${record._id}')">Delete</button>
            </div>
          </div>
        `).join('');
    } catch (err) {
      console.error('Error:', err);
      recordsContainer.innerHTML = '<div class="no-records">Error loading records</div>';
    }
  }

  // Search handler
  searchBtn.addEventListener('click', () => {
    const type = searchType.value;
    const value = searchInput.value.trim();
    loadRecords(type, value);
  });

  // Clear handler
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    loadRecords();
  });

  // Delete function (global)
  window.deleteRecord = async (id) => {
    if (!confirm('Delete this record?')) return;

    try {
      const response = await fetch(`http://localhost:5000/api/records/${id}`, { method: 'DELETE' });
      const result = await response.json();
      // alert(result.message);
      loadRecords(); // Refresh list
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Delete failed');
    }
  };
});



























document.addEventListener('DOMContentLoaded', function () {
  // Set default date to today
  const now = new Date();
  now.setHours(now.getHours() + 5); // Adjust for UTC+5 (Pakistan time)
  const today = now.toISOString().split('T')[0];

  document.getElementById('date-picker').value = today;

  // Add event listener to fetch button
  document.getElementById('fetch-btn').addEventListener('click', fetchAttendance);

  // Also fetch when date changes
  document.getElementById('date-picker').addEventListener('change', fetchAttendance);

  // Initial fetch for today's attendance
  fetchAttendance();
});

async function fetchAttendance() {
  const date = document.getElementById('date-picker').value;
  if (!date) return;

  try {
    const response = await fetch(`http://localhost:5000/api/attendance/date/${date}`);
    if (!response.ok) throw new Error('Failed to fetch attendance');

    const data = await response.json();
    displayAttendance(data);
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('no-data').textContent = 'Error loading attendance data';
    document.getElementById('no-data').style.display = 'block';
    document.getElementById('attendance-body').innerHTML = '';
    document.getElementById('stats-container').innerHTML = '';
  }
}

function displayAttendance(attendanceData) {
  const attendanceBody = document.getElementById('attendance-body');
  const statsContainer = document.getElementById('stats-container');
  const noDataDiv = document.getElementById('no-data');

  if (!attendanceData || !attendanceData.attend || attendanceData.attend.length === 0) {
    noDataDiv.textContent = 'No attendance records found for this date';
    noDataDiv.style.display = 'block';
    attendanceBody.innerHTML = '';
    statsContainer.innerHTML = '';
    return;
  }

  noDataDiv.style.display = 'none';

  // Calculate stats
  const presentCount = attendanceData.attend.filter(p => p.status === 'present').length;
  const absentCount = attendanceData.attend.length - presentCount;

  // Update stats
  statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${attendanceData.attend.length}</div>
            <div>Total</div>
        </div>
        <div class="stat-card">
            <div class="stat-value present">${presentCount}</div>
            <div>Present</div>
        </div>
        <div class="stat-card">
            <div class="stat-value absent">${absentCount}</div>
            <div>Absent</div>
        </div>
    `;

  // Update table
  attendanceBody.innerHTML = attendanceData.attend.map(person => `
        <tr>
            <td>${person.regno}</td>
            <td>${person.name || 'N/A'}</td>
            <td class="status-${person.status}">${person.status.toUpperCase()}</td>
            <td>${person.lastRecognized ? new Date(person.lastRecognized).toLocaleString() : 'N/A'}</td>
        </tr>
    `).join('');
}





































document.addEventListener('DOMContentLoaded', function () {
  // Set up filter buttons
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(button => {
    button.addEventListener('click', function () {
      filterButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      const filter = this.getAttribute('data-filter');
      fetchUnknownLogs(filter);
    });
  });


  // Initial fetch for today's logs
  fetchUnknownLogs('today');
});

async function fetchUnknownLogs(timeFilter2) {
  try {
    const response = await fetch(`http://localhost:5000/api/unknown-logs?filter=${timeFilter2}`);
    if (!response.ok) throw new Error('Failed to fetch logs');

    const logs = await response.json();
    displayUnknownLogs(logs);
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('log-count').textContent = 'Error loading logs';
    document.getElementById('logs-container').innerHTML =
      '<div class="no-logs">Could not load unknown person logs</div>';
  }
}

function displayUnknownLogs(logs) {
  const logsContainer = document.getElementById('logs-container');
  const logCount = document.getElementById('log-count');

  if (!logs || logs.length === 0) {
    logCount.textContent = 'No unknown person logs found';
    logsContainer.innerHTML = '<div class="no-logs">No unknown persons detected in this time period</div>';
    return;
  }

  logCount.textContent = `${logs.length} unknown persons detected`;

  logsContainer.innerHTML = logs.map(log => `
      <div class="log-item">
          <img src="${log.picture}" alt="Unknown person" class="log-image">
          <div class="log-details">
              <div><strong>Unknown Person</strong></div>
              <div class="log-time">Detected: ${new Date(log.time).toLocaleString()}</div>
          </div>
      </div>
  `).join('');
}




















document.addEventListener('DOMContentLoaded', function () {
  // Set up filter buttons
  const filterButtons2 = document.querySelectorAll('.filter-btn2');
  filterButtons2.forEach(button => {
    button.addEventListener('click', function () {
      filterButtons2.forEach(btn => btn.classList.remove('active2'));
      this.classList.add('active2');
      const filter2 = this.getAttribute('data-filter2');
      fetchSpoofingLogs(filter2);
    });
  });


  fetchSpoofingLogs('today2');
});

async function fetchSpoofingLogs(timeFilter) {
  try {
    const response2 = await fetch(`http://localhost:5000/api/spoofing-logs?filter2=${timeFilter}`);
    if (!response2.ok) throw new Error('Failed to fetch logs');

    const logs = await response2.json();
    displaySpoofingLogs(logs);
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('log-count2').textContent = 'Error loading logs';
    document.getElementById('logs-container2').innerHTML =
      '<div class="no-logs2">Could not load spoofing detection logs</div>';
  }
}

function displaySpoofingLogs(logs) {
  const logsContainer2 = document.getElementById('logs-container2');
  const logCount2 = document.getElementById('log-count2');

  if (!logs || logs.length === 0) {
    logCount2.textContent = 'No spoofing attempts detected';
    logsContainer2.innerHTML = '<div class="no-logs2">No spoofing attempts detected in this time period</div>';
    return;
  }

  logCount2.textContent = `${logs.length} spoofing attempts detected`;

  logsContainer2.innerHTML = logs.map(log => `
      <div class="log-item2">
          <img src="${log.picture}" alt="Spoofing attempt" class="log-image2">
          <div class="log-details2">
              <div class="spoof-label2">SPOOF ATTEMPT</div>
              <div class="log-identity2">${log.identity === 'unknown' ? 'Unknown Person' : 'Identified as: ' + log.identity}</div>
              <div class="log-time2">Detected: ${new Date(log.time).toLocaleString()}</div>
          </div>
      </div>
  `).join('');
}



















const userWindow = document.getElementById("users-content")
const attendanceWindow = document.getElementById("attendance-content")
const unknownWindow = document.getElementById("unknown-content")
const spoofingWindow = document.getElementById("spoofing-content")

const userBtn = document.getElementById("users-btn");
const attendBtn = document.getElementById("attendance-btn");
const unknownBtn = document.getElementById("unknown-btn");
const spoofBtn = document.getElementById("spoofing-btn");

function menubar_user() {
  userWindow.style.display = 'block'
  attendanceWindow.style.display = 'none';
  unknownWindow.style.display = 'none';
  spoofingWindow.style.display = 'none';

  userBtn.style.backgroundColor = "var(--secondaryclrtransparent)";
  userBtn.style.color = "var(--primaryclr)";

  attendBtn.style.backgroundColor = "rgba(255, 0, 0, 0)";
  attendBtn.style.color = "var(--secondaryclr)";

  unknownBtn.style.backgroundColor = "rgba(255, 0, 0, 0)";
  unknownBtn.style.color = "var(--secondaryclr)";

  spoofBtn.style.backgroundColor = "rgba(255, 0, 0, 0)";
  spoofBtn.style.color = "var(--secondaryclr)";

}

function menubar_attendance() {
  userWindow.style.display = 'none';
  attendanceWindow.style.display = 'block'
  unknownWindow.style.display = 'none';
  spoofingWindow.style.display = 'none';

  userBtn.style.backgroundColor = "rgba(255, 0, 0, 0)";
  userBtn.style.color = "var(--secondaryclr)";

  attendBtn.style.backgroundColor = "var(--secondaryclrtransparent)";
  attendBtn.style.color = "var(--primaryclr)";

  unknownBtn.style.backgroundColor = "rgba(255, 0, 0, 0)";
  unknownBtn.style.color = "var(--secondaryclr)";

  spoofBtn.style.backgroundColor = "rgba(255, 0, 0, 0)";
  spoofBtn.style.color = "var(--secondaryclr)";
}

function menubar_unknown() {
  userWindow.style.display = 'none';
  attendanceWindow.style.display = 'none';
  unknownWindow.style.display = 'block'
  spoofingWindow.style.display = 'none';


  userBtn.style.backgroundColor = "rgba(255, 0, 0, 0)";
  userBtn.style.color = "var(--secondaryclr)";

  attendBtn.style.backgroundColor = "rgba(255, 0, 0, 0)";
  attendBtn.style.color = "var(--secondaryclr)";

  unknownBtn.style.backgroundColor = "var(--secondaryclrtransparent)";
  unknownBtn.style.color = "var(--primaryclr)";

  spoofBtn.style.backgroundColor = "rgba(255, 0, 0, 0)";
  spoofBtn.style.color = "var(--secondaryclr)";
}

function menubar_spoofing() {
  userWindow.style.display = 'none';
  attendanceWindow.style.display = 'none';
  unknownWindow.style.display = 'none';
  spoofingWindow.style.display = 'block'

  userBtn.style.backgroundColor = "rgba(255, 0, 0, 0)";
  userBtn.style.color = "var(--secondaryclr)";

  attendBtn.style.backgroundColor = "rgba(255, 0, 0, 0)";
  attendBtn.style.color = "var(--secondaryclr)";

  unknownBtn.style.backgroundColor = "rgba(255, 0, 0, 0)";
  unknownBtn.style.color = "var(--secondaryclr)";

  spoofBtn.style.backgroundColor = "var(--secondaryclrtransparent)";
  spoofBtn.style.color = "var(--primaryclr)";
}

menubar_user();