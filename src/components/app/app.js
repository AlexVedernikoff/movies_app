import React, { Component } from "react";
import { Spin, Alert, Tabs, Pagination } from "antd";
import { isEqual } from "lodash";

import SearchLine from "../search-line";
import FilmList from "../film-list";
import "./app.css";
import "antd/dist/antd.min.css";
import constants from "../../constants";
import MoviesService from "../../services/movies-service";
import NetworkState from "../../utils/networkState";

const { TabPane } = Tabs;

export default class App extends Component {
  MoviesService = new MoviesService();
  state = {
    isLoading: false,
    error: false,
    films: [],
    query: "",
    page: 1,
    pageRated: 1,
    starsFilms: [],
    totalPages: 0,
    network: false,
    sessionId: null,
    genres: null,
    currentMode: "search"
  };

  onError = () => {
    this.setState({
      error: true,
      isLoading: false
    });
  };

  onNetworkState = () => {
    this.setState((prevState) => ({ network: !prevState.network }));
  };

  createGuestSession() {
    if (!localStorage.getItem("sessionId")) {
      //Поскольку в localStorage нет сохранённого значения гостевой сессии, создаём сессию заново:
      this.MoviesService.createSession().then((session) => {
        this.updateStateSessionId(session);
      });
    } else {
      //В localStorage уже хранится значение sessionId и оно равно:
      this.setState({ sessionId: localStorage.getItem("sessionId") });
    }
  }

  componentDidMount() {
    this.createGuestSession();
    this.MoviesService.getGenres().then((genre) => {
      this.updateStateGenres(genre);
    });
    window.addEventListener("storage", this.onGetRate);
  }

  componentDidUpdate() {
    this.onGetRate();
  }

  updateStateSessionId = (session) => {
    localStorage.setItem("sessionId", session.guest_session_id);
    this.setState({ sessionId: session.guest_session_id });
  };

  updateStateGenres = (genre) => {
    if (!this.state.genres) {
      this.setState({ genres: genre.genres });
    }
  };

  onGetRate = () => {
    const response = {};
    response.results = [];
    if (JSON.parse(localStorage.getItem("ratingFilms"))) {
      response.results = JSON.parse(localStorage.getItem("ratingFilms"));
    }
    const ratingList = response.results.reduce((acc, el) => {
      acc.push({ id: el.id, rating: el.rating });
      return acc;
    }, []);
    if (
      !this.state.ratingList ||
      isEqual(this.state.ratingList, ratingList) === false
    ) {
      this.setState({ starsFilms: response, ratingList });
    }
  };

  onChangeRate = (id, rate, el) => {
    this.putFilmtoLocalStorage(id, rate, el);
    this.MoviesService.setRateMovies(id, this.state.sessionId, rate).catch(
      this.onError
    );
    this.onGetRate();
  };

  putFilmtoLocalStorage = (id, rate, el) => {
    let isMatching = false;
    el.rating = rate;
    let arr = [];
    if (JSON.parse(localStorage.getItem("ratingFilms"))) {
      arr = JSON.parse(localStorage.getItem("ratingFilms"));
    }
    if (!arr.length) {
      arr.push(el);
    }
    arr.forEach((film, i) => {
      if (film.id === el.id) {
        arr[i] = el;
        isMatching = true;
      }
    });
    if (!isMatching) {
      arr.push(el);
    }
    localStorage.setItem("ratingFilms", JSON.stringify(arr));
  };

  updateMovies = (query, page) => {
    this.MoviesService.getMovies(query, page)
      .then((response) => {
        if (response) {
          if (this.state.films !== response.results) {
            this.setState({
              films: response.results,
              query: query,
              totalPages: response.total_results,
              isLoading: false,
              page: page,
              error: false
            });
          }
        }
      })
      .catch(this.onError);
  };

  receiveQuery = (query) => {
    this.setState({
      isLoading: true
    });
    if (!query) {
      this.setState({
        query: "",
        totalPages: 0
      });
      return;
    }
    if (query !== this.state.query) {
      this.updateMovies(query, 1);
    }
  };

  onChangePage = (page) => {
    const { currentMode } = this.state;
    this.updateMovies(this.state.query, page);
    if (currentMode === "search") {
      this.setState({
        page,
        isLoading: true
      });
    } else {
      this.setState({
        pageRated: page
      });
    }
  };

  onChangePageRated = (page) => {
    this.setState({
      pageRated: page
    });
  };

  onChangeMode = (activeKey) => {
    this.setState({
      currentMode: activeKey
    });
  };

  componentWillUnmount() {
    window.removeEventListener("storage", this.onGetRate);
  }

  render() {
    const {
      network,
      error,
      isLoading,
      totalPages,
      page,
      pageRated,
      starsFilms,
      ratingList,
      query,
      films,
      genres
    } = this.state;
    const { messageWillRate } = constants;

    return (
      <div className="wrapper">
        <NetworkState onNetworkState={this.onNetworkState} />
        {network ? (
          <Alert
            className="alert alert-net"
            message={constants.messageFailNet}
          />
        ) : null}
        {error ? (
          <Alert
            className="alert"
            message={constants.messageFailUrl}
            type="error"
            showIcon
            closable
          />
        ) : null}
        <Tabs
          size="large"
          centered="true"
          defaultActiveKey="search"
          onChange={this.onChangeMode}
        >
          <TabPane tab="Search" key="search">
            <SearchLine receiveQuery={this.receiveQuery} />
            {query ? (
              isLoading ? (
                <Spin className="spin" size="large" />
              ) : (
                <FilmList
                  films={films}
                  genres={genres}
                  onChangeRate={this.onChangeRate}
                  page={"search"}
                  ratingList={ratingList}
                  query={query}
                />
              )
            ) : (
              <Alert message={"Введите поисковый запрос"} />
            )}

            <Pagination
              current={page}
              total={totalPages}
              onChange={this.onChangePage}
              showSizeChanger={false}
              defaultPageSize={20}
            />
          </TabPane>
          <TabPane tab="Rated" key="rated">
            {!starsFilms.results || !starsFilms.results.length ? (
              <Alert message={messageWillRate} />
            ) : (
              <FilmList
                films={starsFilms.results}
                genres={genres}
                onChangeRate={this.onChangeRate}
                page={"rated"}
                ratingList={ratingList}
                query={query}
                current={pageRated}
              />
            )}
            <Pagination
              current={pageRated}
              total={starsFilms.results ? starsFilms.results.length : 0}
              onChange={this.onChangePageRated}
              showSizeChanger={false}
              defaultPageSize={20}
            />
          </TabPane>
        </Tabs>
      </div>
    );
  }
}
