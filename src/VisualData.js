import React, {  useState, useCallback } from "react";
import { Bar, Pie } from "react-chartjs-2";
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement,
  ArcElement,
  Title, 
  Tooltip, 
  Legend 
} from "chart.js";
import './VisualData.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const VisualData = ({ orders = [], reservations = [] }) => {
  const [dateFilter, setDateFilter] = useState("Last 15 Days");
  const [activeTab, setActiveTab] = useState("summary");

  // Filter data by date range
  const filterByDate = useCallback((data, dateField = 'orderTime') => {
    const now = new Date();
    let filtered = data;

    if (dateFilter === "Today") {
      filtered = data.filter(
        item => item?.[dateField] && new Date(item[dateField]).toDateString() === now.toDateString()
      );
    } else if (dateFilter === "Last 3 Days") {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(now.getDate() - 3);
      filtered = data.filter(item => 
        item?.[dateField] && new Date(item[dateField]) >= threeDaysAgo
      );
    } else if (dateFilter === "Last 15 Days") {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(now.getDate() - 15);
      filtered = data.filter(item => 
        item?.[dateField] && new Date(item[dateField]) >= fifteenDaysAgo
      );
    } else if (dateFilter === "Last Month") {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(now.getMonth() - 1);
      filtered = data.filter(item => 
        item?.[dateField] && new Date(item[dateField]) >= oneMonthAgo
      );
    }

    return filtered || [];
  }, [dateFilter]);

  const filteredOrders = filterByDate(orders);
  const filteredReservations = filterByDate(reservations, 'date');

  // Categorize orders
  const deliveryOrders = filteredOrders.filter(o => o.deliveryOption === 'delivery');
  const tapCollectOrders = filteredOrders.filter(o => 
    o.deliveryOption === 'tapAndCollect' || o.deliveryOption === 'pickup'
  );

  // Process data for charts
  const processTimeSeriesData = (data, dateField) => {
    const grouped = data.reduce((acc, item) => {
      if (!item?.[dateField]) return acc;
      const date = new Date(item[dateField]).toLocaleDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    return {
      labels: Object.keys(grouped),
      datasets: [{
        label: 'Count',
        data: Object.values(grouped),
        backgroundColor: 'rgba(93, 64, 55, 0.7)',
        borderColor: 'rgba(93, 64, 55, 1)',
        borderWidth: 1,
        borderRadius: 4,
      }]
    };
  };

  const processOrderTypeData = () => ({
    labels: ['Delivery', 'Tap & Collect'],
    datasets: [{
      data: [deliveryOrders.length, tapCollectOrders.length],
      backgroundColor: ['rgba(255, 87, 34, 0.7)', 'rgba(141, 110, 99, 0.7)'],
      borderColor: ['rgba(255, 87, 34, 1)', 'rgba(141, 110, 99, 1)'],
      borderWidth: 1
    }]
  });

  const processReservationStatusData = () => {
    const now = new Date();
    const upcoming = filteredReservations.filter(r => new Date(r.date) >= now).length;
    const past = filteredReservations.length - upcoming;

    return {
      labels: ['Upcoming', 'Past'],
      datasets: [{
        data: [upcoming, past],
        backgroundColor: ['rgba(76, 175, 80, 0.7)', 'rgba(158, 158, 158, 0.7)'],
        borderColor: ['rgba(76, 175, 80, 1)', 'rgba(158, 158, 158, 1)'],
        borderWidth: 1
      }]
    };
  };

  // Chart options
  const barOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y} ${ctx.dataset.label.toLowerCase()}`
        }
      }
    },
    scales: { y: { beginAtZero: true } }
  };

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'right' },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.label || '';
            const value = ctx.raw || 0;
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };

  // Calculate summary statistics
  const calculateSummary = () => {
    const reservationData = processReservationStatusData();
    
    // Best performing day for orders
    const orderDates = filteredOrders.reduce((acc, order) => {
      if (!order?.orderTime) return acc;
      const date = new Date(order.orderTime).toLocaleDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});
    
    const bestOrderDay = Object.keys(orderDates).length > 0 
      ? Object.keys(orderDates).reduce((a, b) => orderDates[a] > orderDates[b] ? a : b)
      : "N/A";
    
    // Reservation trends
    const reservationDates = filteredReservations.reduce((acc, res) => {
      if (!res?.date) return acc;
      const date = new Date(res.date).toLocaleDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});
    
    const bestResDay = Object.keys(reservationDates).length > 0 
      ? Object.keys(reservationDates).reduce((a, b) => reservationDates[a] > reservationDates[b] ? a : b)
      : "N/A";

    return {
      totalOrders: filteredOrders.length,
      totalReservations: filteredReservations.length,
      deliveryOrders: deliveryOrders.length,
      tapCollectOrders: tapCollectOrders.length,
      upcomingReservations: reservationData.datasets[0].data[0],
      bestOrderDay,
      bestOrderDayCount: bestOrderDay !== "N/A" ? orderDates[bestOrderDay] : 0,
      bestResDay,
      bestResDayCount: bestResDay !== "N/A" ? reservationDates[bestResDay] : 0,
    };
  };

  const summaryStats = calculateSummary();

  return (
    <div className="visual-data">
      <div className="visual-header">
        <h2>Restaurant Analytics Dashboard</h2>
        <div className="controls">
          <div className="tabs">
            <button 
              className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              Summary
            </button>
            <button 
              className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              Orders
            </button>
            <button 
              className={`tab-btn ${activeTab === 'reservations' ? 'active' : ''}`}
              onClick={() => setActiveTab('reservations')}
            >
              Reservations
            </button>
          </div>
          <select 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)}
            className="date-filter"
          >
            <option value="Today">Today</option>
            <option value="Last 3 Days">Last 3 Days</option>
            <option value="Last 15 Days">Last 15 Days</option>
            <option value="Last Month">Last Month</option>
          </select>
        </div>
      </div>

      {activeTab === 'summary' && (
        <div className="summary-view">
          <div className="stats-grid">
            <div className="stat-card primary">
              <h3>Total Orders</h3>
              <p>{summaryStats.totalOrders}</p>
              <small>{dateFilter} period</small>
            </div>
            <div className="stat-card accent">
              <h3>Total Reservations</h3>
              <p>{summaryStats.totalReservations}</p>
              <small>{dateFilter} period</small>
            </div>
            <div className="stat-card">
              <h3>Delivery Orders</h3>
              <p>{summaryStats.deliveryOrders}</p>
              <small>{Math.round(summaryStats.deliveryOrders / summaryStats.totalOrders * 100)}% of total</small>
            </div>
            <div className="stat-card">
              <h3>Tap & Collect</h3>
              <p>{summaryStats.tapCollectOrders}</p>
              <small>{Math.round(summaryStats.tapCollectOrders / summaryStats.totalOrders * 100)}% of total</small>
            </div>
          </div>

          <div className="chart-row">
            <div className="chart-container">
              <h3>Order Types Distribution</h3>
              <Pie data={processOrderTypeData()} options={pieOptions} />
            </div>
            <div className="chart-container">
              <h3>Reservation Status</h3>
              <Pie data={processReservationStatusData()} options={pieOptions} />
            </div>
          </div>

          <div className="insights">
            <h3>Key Insights</h3>
            <div className="insight-cards">
              <div className="insight-card">
                <h4>Peak Order Day</h4>
                <p>{summaryStats.bestOrderDay}</p>
                <small>{summaryStats.bestOrderDayCount} orders</small>
              </div>
              <div className="insight-card">
                <h4>Peak Reservation Day</h4>
                <p>{summaryStats.bestResDay}</p>
                <small>{summaryStats.bestResDayCount} reservations</small>
              </div>
              <div className="insight-card">
                <h4>Upcoming Reservations</h4>
                <p>{summaryStats.upcomingReservations}</p>
                <small>{Math.round(summaryStats.upcomingReservations / summaryStats.totalReservations * 100)}% of total</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="orders-view">
          <div className="chart-row">
            <div className="chart-container">
              <h3>Orders Over Time</h3>
              <Bar 
                data={processTimeSeriesData(filteredOrders, 'orderTime')} 
                options={barOptions} 
              />
            </div>
            <div className="chart-container">
              <h3>Order Types</h3>
              <Pie data={processOrderTypeData()} options={pieOptions} />
            </div>
          </div>

          <div className="order-stats">
            <div className="stat-card">
              <h4>Total Orders</h4>
              <p>{filteredOrders.length}</p>
            </div>
            <div className="stat-card">
              <h4>Delivery Orders</h4>
              <p>{deliveryOrders.length}</p>
              <small>{Math.round(deliveryOrders.length / filteredOrders.length * 100)}%</small>
            </div>
            <div className="stat-card">
              <h4>Tap & Collect</h4>
              <p>{tapCollectOrders.length}</p>
              <small>{Math.round(tapCollectOrders.length / filteredOrders.length * 100)}%</small>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reservations' && (
        <div className="reservations-view">
          <div className="chart-row">
            <div className="chart-container">
              <h3>Reservations Over Time</h3>
              <Bar 
                data={processTimeSeriesData(filteredReservations, 'date')} 
                options={barOptions} 
              />
            </div>
            <div className="chart-container">
              <h3>Reservation Status</h3>
              <Pie data={processReservationStatusData()} options={pieOptions} />
            </div>
          </div>

          <div className="reservation-stats">
            <div className="stat-card">
              <h4>Total Reservations</h4>
              <p>{filteredReservations.length}</p>
            </div>
            <div className="stat-card">
              <h4>Upcoming</h4>
              <p>{summaryStats.upcomingReservations}</p>
              <small>{Math.round(summaryStats.upcomingReservations / filteredReservations.length * 100)}%</small>
            </div>
            <div className="stat-card">
              <h4>Average Party Size</h4>
              <p>{filteredReservations.length > 0 
                ? (filteredReservations.reduce((sum, res) => sum + (res.guests || 0), 0) / filteredReservations.length).toFixed(1)
                : 0}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualData;