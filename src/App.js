import React, { useEffect, useState } from "react";
import "./App.css";
import VisualData from "./VisualData";

const App = () => {
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOption, setMenuOption] = useState("Tap & Collect");
  const [timeSelections, setTimeSelections] = useState({});
  const [timeSentStatus, setTimeSentStatus] = useState({});
  const [hoveredItem, setHoveredItem] = useState(null);
  const [dateFilter, setDateFilter] = useState("all"); // New state for date filter

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch orders
        const ordersResponse = await fetch(`https://tajmahal-server.gofastapi.com/getOrders`);
        if (!ordersResponse.ok) throw new Error(`Error fetching orders: ${ordersResponse.statusText}`);
        const ordersData = await ordersResponse.json();

        // Fetch reservations
        const reservationsResponse = await fetch(`https://tajmahal-server.gofastapi.com/getReservations`);
        if (!reservationsResponse.ok) throw new Error(`Error fetching reservations: ${reservationsResponse.statusText}`);
        const reservationsData = await reservationsResponse.json();

        if (!ordersData.orders || !Array.isArray(ordersData.orders)) {
          throw new Error('Invalid orders data structure received from server');
        }

        if (!reservationsData.reservations || !Array.isArray(reservationsData.reservations)) {
          throw new Error('Invalid reservations data structure received from server');
        }

        const sortedOrders = ordersData.orders
          .filter(order => order && order.dishes && Array.isArray(order.dishes))
          .sort((a, b) => new Date(b.orderTime) - new Date(a.orderTime));

        const sortedReservations = reservationsData.reservations
          .sort((a, b) => new Date(b.date) - new Date(a.date));

        setOrders(sortedOrders);
        setReservations(sortedReservations);
        setError("");
      } catch (err) {
        setError(err.message);
        setOrders([]);
        setReservations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 10000);
    return () => clearInterval(intervalId);
  }, [menuOption]);

  // Calculate date ranges based on filter
  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case "1day":
        return new Date(now.setDate(now.getDate() - 1));
      case "3days":
        return new Date(now.setDate(now.getDate() - 3));
      case "1week":
        return new Date(now.setDate(now.getDate() - 7));
      case "15days":
        return new Date(now.setDate(now.getDate() - 15));
      case "1month":
        return new Date(now.setMonth(now.getMonth() - 1));
      default:
        return null; // "all" option
    }
  };

  // Filter functions with date filtering
  const filterOrdersByTypeAndDate = () => {
    let filteredOrders = orders;
    const cutoffDate = getDateRange();

    // Apply date filter if not "all"
    if (dateFilter !== "all") {
      filteredOrders = filteredOrders.filter(order => 
        order.orderTime && new Date(order.orderTime) >= cutoffDate
      );
    }

    // Apply menu option filter
    if (menuOption === "Tap & Collect") {
      return filteredOrders.filter(order => 
        order.deliveryOption === 'tapAndCollect' || order.deliveryOption === 'pickup'
      );
    } else if (menuOption === "Delivery Orders") {
      return filteredOrders.filter(order => order.deliveryOption === 'delivery');
    }
    return filteredOrders;
  };

  const filterReservationsByDate = () => {
    if (dateFilter === "all") return reservations;
    
    const cutoffDate = getDateRange();
    return reservations.filter(reservation => 
      reservation.date && new Date(reservation.date) >= cutoffDate
    );
  };

  // Count functions with date filtering
  const pendingDeliveryCount = orders.filter(order => 
    order.deliveryOption === 'delivery' && !order.isDelivered &&
    (dateFilter === "all" || (order.orderTime && new Date(order.orderTime) >= getDateRange()))
  ).length;

  const pendingPickupCount = orders.filter(order => 
    (order.deliveryOption === 'tapAndCollect' || order.deliveryOption === 'pickup') && 
    !order.isDelivered &&
    (dateFilter === "all" || (order.orderTime && new Date(order.orderTime) >= getDateRange()))
  ).length;

  const upcomingReservationsCount = reservations.filter(reservation => 
    new Date(reservation.date) >= new Date() &&
    (dateFilter === "all" || new Date(reservation.date) >= getDateRange())
  ).length;

  // Action handlers (unchanged)
  const handleMarkAsDelivered = async (orderId) => {
    try {
      const response = await fetch(`https://tajmahal-server.gofastapi.com/markAsDelivered`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error marking order as delivered");
      }
      
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order && order._id === orderId ? { ...order, isDelivered: true } : order
        )
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSendTimeEstimate = async (orderId, email) => {
    try {
      const selectedTime = timeSelections[orderId] || "10";
      const response = await fetch(`https://tajmahal-server.gofastapi.com/timeDetails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          email,
          expectedTime: `${selectedTime} minutes` 
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send time estimate");
      }

      setTimeSentStatus(prev => ({
        ...prev,
        [orderId]: `${selectedTime} minutes sent at ${new Date().toLocaleTimeString()}`
      }));

    } catch (err) {
      setError(err.message);
    }
  };

  // Render functions (updated to use filtered data)
  const renderOrders = () => {
    const filteredOrders = filterOrdersByTypeAndDate();

    if (!filteredOrders || filteredOrders.length === 0) {
      return <div className="no-orders">No {menuOption.toLowerCase()} found for selected date range</div>;
    }

    return (
      <div className="order-table-container">
        <table className="order-table">
          <thead>
            <tr>
              <th className="dish-col">Dish</th>
              <th className="qty-col">Qty</th>
              <th className="price-col">Price</th>
              <th className="time-col">Order Time</th>
              <th className="date-col">Order Date</th>
              <th className="email-col">Email</th>
              {menuOption === "Delivery Orders" && (
                <th className="address-col">Address</th>
              )}
              <th className="status-col">Status</th>
              <th className="estimate-col">Time Estimate</th>
              <th className="sent-col">Time Sent</th>
              <th className="deliver-col">Mark Delivered</th>
              <th className="send-col">Send Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => {
              if (!order || !order.dishes || !Array.isArray(order.dishes)) return null;
              
              const date = order.orderTime ? new Date(order.orderTime) : new Date();
              const isTimeSent = timeSentStatus[order._id];
              
              return (
                <React.Fragment key={order._id || Math.random()}>
                  {order.dishes.map((item, idx) => (
                    <tr 
                      key={`${order._id}-${idx}`}
                      className={hoveredItem === order._id ? 'row-hovered' : ''}
                      onMouseEnter={() => setHoveredItem(order._id)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <td className="dish-col">{item?.name || "N/A"}</td>
                      <td className="qty-col">{item?.quantity || 0}</td>
                      <td className="price-col">${item?.price?.toFixed(2) || "0.00"}</td>
                      {idx === 0 && (
                        <>
                          <td className="time-col" rowSpan={order.dishes.length}>
                            {date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </td>
                          <td className="date-col" rowSpan={order.dishes.length}>
                            {date.toLocaleDateString()}
                          </td>
                          <td className="email-col" rowSpan={order.dishes.length}>
                            <span className="email-text">{order.email || "N/A"}</span>
                          </td>
                          {menuOption === "Delivery Orders" && (
                            <td className="address-col" rowSpan={order.dishes.length}>
                              <div className="address-text">
                                <div>{order.name || "N/A"}</div>
                                <div>{order.address || "N/A"}</div>
                              </div>
                            </td>
                          )}
                          <td className="status-col" rowSpan={order.dishes.length}>
                            <span className={`status ${order.isDelivered ? "delivered" : "pending"}`}>
                              {order.isDelivered ? "Delivered" : "Pending"}
                            </span>
                          </td>
                          <td className="estimate-col" rowSpan={order.dishes.length}>
                            <div className="time-select-wrapper">
                              <select
                                value={timeSelections[order._id] || "10"}
                                onChange={(e) => setTimeSelections(prev => ({
                                  ...prev,
                                  [order._id]: e.target.value
                                }))}
                                className="time-select"
                                disabled={isTimeSent}
                              >
                                <option value="10">10 minutes</option>
                                <option value="20">20 minutes</option>
                                <option value="30">30 minutes</option>
                              </select>
                            </div>
                          </td>
                          <td className="sent-col" rowSpan={order.dishes.length}>
                            {isTimeSent ? (
                              <span className="time-sent-badge">
                                ✓ Sent
                              </span>
                            ) : (
                              <span className="not-sent">-</span>
                            )}
                          </td>
                          <td className="deliver-col" rowSpan={order.dishes.length}>
                            {!order.isDelivered && (
                              <button
                                className="action-button mark-delivered"
                                onClick={() => handleMarkAsDelivered(order._id)}
                              >
                                Mark Delivered
                              </button>
                            )}
                          </td>
                          <td className="send-col" rowSpan={order.dishes.length}>
                            {!order.isDelivered && (
                              <button
                                className={`action-button send-time ${isTimeSent ? "disabled" : ""}`}
                                onClick={() => !isTimeSent && handleSendTimeEstimate(order._id, order.email)}
                                disabled={isTimeSent}
                              >
                                {isTimeSent ? "Sent" : "Send Time"}
                              </button>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderReservations = () => {
    const filteredReservations = filterReservationsByDate();
    
    if (!filteredReservations || filteredReservations.length === 0) {
      return <div className="no-reservations">No reservations found for selected date range</div>;
    }

    return (
      <div className="reservation-table-container">
        <table className="reservation-table">
          <thead>
            <tr>
              <th className="name-col">Name</th>
              <th className="email-col">Email</th>
              <th className="phone-col">Phone</th>
              <th className="date-col">Date</th>
              <th className="time-col">Time</th>
              <th className="guests-col">Guests</th>
              <th className="requests-col">Special Requests</th>
              <th className="status-col">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredReservations.map((reservation) => {
              const reservationDate = new Date(reservation.date);
              const isUpcoming = reservationDate >= new Date();
              
              return (
                <tr 
                  key={reservation._id || Math.random()}
                  className={isUpcoming ? 'upcoming' : 'past'}
                >
                  <td className="name-col">{reservation.name || "N/A"}</td>
                  <td className="email-col">
                    <span className="email-text">{reservation.email || "N/A"}</span>
                  </td>
                  <td className="phone-col">{reservation.phone || "N/A"}</td>
                  <td className="date-col">
                    {reservationDate.toLocaleDateString()}
                  </td>
                  <td className="time-col">{reservation.time || "N/A"}</td>
                  <td className="guests-col">{reservation.guests || "N/A"}</td>
                  <td className="requests-col">
                    {reservation.specialRequests || "None"}
                  </td>
                  <td className="status-col">
                    <span className={`status ${isUpcoming ? "upcoming" : "past"}`}>
                      {isUpcoming ? "Upcoming" : "Past"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Restaurant Dashboard</h2>
        </div>
        <ul className="menu-list">
          {["Tap & Collect", "Delivery Orders", "Reservations", "Visual Data"].map((item) => (
            <li
              key={item}
              className={`menu-item ${menuOption === item ? "active" : ""}`}
              onClick={() => {
                setMenuOption(item);
                // Reset date filter when switching tabs (optional)
                // setDateFilter("all");
              }}
            >
              <span className="menu-icon">
                {item === "Tap & Collect" ? "🛍️" : 
                 item === "Delivery Orders" ? "🚚" : 
                 item === "Reservations" ? "📅" :
                 item === "Visual Data" ? "📊" : "📋"}
              </span>
              <span className="menu-text">
                {item}
                {item === "Tap & Collect" && pendingPickupCount > 0 && (
                  <span className="menu-badge">
                    {pendingPickupCount}
                  </span>
                )}
                {item === "Delivery Orders" && pendingDeliveryCount > 0 && (
                  <span className="menu-badge">
                    {pendingDeliveryCount}
                  </span>
                )}
                {item === "Reservations" && upcomingReservationsCount > 0 && (
                  <span className="menu-badge">
                    {upcomingReservationsCount}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="main-content">
        <div className="content-header">
          <h1>{menuOption}</h1>
          <div className="header-controls">
            <div className="summary-info">
              {menuOption === "Tap & Collect" && (
                <>Showing {filterOrdersByTypeAndDate().length} tap & collect orders ({pendingPickupCount} pending)</>
              )}
              {menuOption === "Delivery Orders" && (
                <>Showing {filterOrdersByTypeAndDate().length} delivery orders ({pendingDeliveryCount} pending)</>
              )}
              {menuOption === "Reservations" && (
                <>Showing {filterReservationsByDate().length} reservations ({upcomingReservationsCount} upcoming)</>
              )}
            </div>
            {menuOption !== "Visual Data" && (
              <div className="date-filter">
                <label htmlFor="date-filter-select">Show: </label>
                <select
                  id="date-filter-select"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="date-filter-select"
                >
                  <option value="all">All dates</option>
                  <option value="1day">Last 1 day</option>
                  <option value="3days">Last 3 days</option>
                  <option value="1week">Last 1 week</option>
                  <option value="15days">Last 15 days</option>
                  <option value="1month">Last 1 month</option>
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="content-details">
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p className="loading-text">Loading data...</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <div className="error-icon">⚠️</div>
              <p className="error-text">{error}</p>
            </div>
          ) : menuOption === "Visual Data" ? (
            <VisualData orders={orders} reservations={reservations} />
          ) : menuOption === "Reservations" ? (
            renderReservations()
          ) : (
            renderOrders()
          )}
        </div>
      </div>
    </div>
  );
};

export default App;