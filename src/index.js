import React, {
  Component,
  PropTypes,
  Children,
} from 'react';
import { media } from 'react-responsive-mixin';
import { getElementWidth, getSwipeDirection, isTouchDevice } from './common/helpers';
import InfiniteCarouselArrow from './components/InfiniteCarouselArrow';
import InfiniteCarouselDots from './components/InfiniteCarouselDots';

import styles from './components/InfiniteCarousel.css';

class InfiniteCarousel extends Component {

  static propTypes = {
    children: PropTypes.oneOfType([
      PropTypes.arrayOf(React.PropTypes.node),
      PropTypes.node
    ]).isRequired,
    arrows: PropTypes.bool,
    dots: PropTypes.bool,
    lazyLoad: PropTypes.bool,
    swipe: PropTypes.bool,
    animationDuration: PropTypes.number,
    slidesToShow: PropTypes.number,
    slidesToScroll: PropTypes.number,
    slidesSpacing: PropTypes.number,
    autoCycle: PropTypes.bool,
    cycleInterval: PropTypes.number,
    pauseOnHover: PropTypes.bool,
    responsive: PropTypes.bool,
    breakpoints: PropTypes.arrayOf(PropTypes.object),
    placeholderImageSrc: PropTypes.string,
    nextArrow: PropTypes.element,
    prevArrow: PropTypes.element,
    scrollOnDevice: PropTypes.bool,
  };

  static defaultProps = {
    children: [],
    arrows: true,
    dots: false,
    lazyLoad: true,
    swipe: true,
    draggable: false,
    animationDuration: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    slidesSpacing: 10,
    autoCycle: false,
    cycleInterval: 5000,
    pauseOnHover: true,
    responsive: true,
    breakpoints: [],
    placeholderImageSrc: 'data:image/gif;base64,R0lGODlhAQABAIABAEdJRgAAACwAAAAAAQABAAACAkQBAA==',
    nextArrow: null,
    prevArrow: null,
    scrollOnDevice: false,
  };

  constructor(props) {
    super(props);

    // initial state
    this.state = {
      currentIndex: 0,
      activePage: 0,
      children: [],
      lazyLoadedList: [],
      childrenCount: 0,
      slidesCount: 0,
      slidesWidth: 1,
      slidePages: 1,
      frameWidth: 1,
      settings: {},
      breakpoints: {},
      autoCycleTimer: null,
      resizeTimer: null,
      dragging: false,
      touchObject: {
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
        length: 0,
        direction: -1,
      },
      isTouchDevice: false,
      scrollOnDeviceProps: {
        arrows: false,
        dots: false,
        lazyLoad: false,
        autoCycle: false,
      },
    };
  }

  componentWillMount() {
    this.init();
  }

  componentDidMount() {
    this.setDimensions();

    if (!window) {
      return;
    }
    if (window.addEventListener) {
      window.addEventListener('resize', this.onWindowResized);
    } else {
      window.attachEvent('onresize', this.onWindowResized);
    }

    if (this.state.settings.autoCycle) {
      this.playAutoCycle();
    }
  }

  componentWillUnmount() {
    if (window.addEventListener) {
      window.removeEventListener('resize', this.onWindowResized);
    } else {
      window.detachEvent('onresize', this.onWindowResized);
    }
    if (this.state.autoCycleTimer) {
      clearInterval(this.state.autoCycleTimer);
    }
  }

  setupBreakpointSettings = (breakpointsSettings) => {
    const breakpoints = breakpointsSettings.map(element => element.breakpoint);
    const settings = {};
    breakpointsSettings.forEach((element) => { settings[element.breakpoint] = element.settings; });
    if (breakpoints.length > 0) {
      breakpoints.sort();
      // Register responsive media queries in settings
      breakpoints.forEach((element, index) => {
        let query;
        if (index === 0) {
          query = { minWidth: 0, maxWidth: element };
        } else {
          query = { minWidth: breakpoints[index - 1], maxWidth: element };
        }
        media(query, () => {
          const scrollOnDeviceProps = isTouchDevice() ? this.state.scrollOnDeviceProps : {};
          this.setState({
            settings: Object.assign(
              {},
              this.defaultProps,
              this.props,
              settings[element],
              scrollOnDeviceProps
            ),
          });
        });
      });

      // Resize from small to large
      breakpoints.reverse();
      const query = { minWidth: (breakpoints[0] + 1) };
      media(query, () => {
        const scrollOnDeviceProps = isTouchDevice() ? this.state.scrollOnDeviceProps : {};
        this.setState({
          settings: Object.assign({}, this.defaultProps, this.props, scrollOnDeviceProps),
        });
      });
    }
  };

  setDimensions = () => {
    const settings = this.state.settings;
    const scrollOnDevice = this.props.scrollOnDevice && this.state.isTouchDevice;
    
    const childrenCount = Children.count(this.props.children);
    const slidesCount =  scrollOnDevice ? childrenCount : Children.count(this.state.children);
    const frameWidth = getElementWidth(this.refs.frame);
    const slidesWidth = (frameWidth / settings.slidesToShow) - (settings.slidesSpacing * 2);
    const childrenLength = this.props.children.length;
    const lazyLoadedList = this.getLazyLoadedIndexes(this.props.children, this.state.currentIndex);
    const activePage = Math.ceil(this.state.currentIndex / settings.slidesToShow);
    const countPages = Math.ceil(childrenLength / settings.slidesToShow);
    const slidePages = childrenLength > settings.slidesToShow ? countPages : 1;

    this.setState({
      activePage,
      childrenCount,
      slidesCount,
      slidesWidth,
      frameWidth,
      slidePages,
      lazyLoadedList,
    });
  };

  getLazyLoadedIndexes = (children, currentIndex) => {
    const lazyLoadedList = this.state.lazyLoadedList;
    let start;
    let limit;
    const settings = this.state.settings;

    start = children.length + this.props.slidesToShow;
    if (currentIndex === 0 && this.state.lazyLoadedList.indexOf(0) < 0) {
      limit = (start + settings.slidesToShow) - 1;
      for (let index = start; index <= limit; index += 1) {
        lazyLoadedList.push(index);
      }
    }

    start = 0;
    const isAtLastPage = currentIndex === children.length - settings.slidesToShow;
    const notLazyLoaded = lazyLoadedList.indexOf((children.length + settings.slidesToShow) - 1) < 0;

    if (isAtLastPage && notLazyLoaded) {
      limit = (start + this.props.slidesToShow) - 1;
      for (let index = start; index <= limit; index += 1) {
        lazyLoadedList.push(index);
      }
    }

    start = currentIndex + this.props.slidesToShow;
    limit = start + (settings.slidesToShow - 1);

    for (let index = start; index <= limit; index += 1) {
      if (this.state.lazyLoadedList.indexOf(index) < 0) {
        lazyLoadedList.push(index);
      }
    }

    return lazyLoadedList;
  };

  getChildrenList = (children, slidesToShow) => {
    if (!Array.isArray(children)) {
      return [children];
    }

    if (children.length > slidesToShow) {
      return [
        ...(children.slice(children.length - slidesToShow, children.length)),
        ...children,
        ...(children.slice(0, slidesToShow)),
      ];
    } else {
      return children;
    }
  };

  getTargetIndex = (index, slidesToScroll) => {
    let targetIndex = index;
    const childrenReminder = this.state.childrenCount % slidesToScroll;
    if (index < 0) {
      if (this.state.currentIndex === 0) {
        targetIndex = this.state.childrenCount - slidesToScroll;
      } else {
        targetIndex = 0;
      }
    } else if (index >= this.state.childrenCount) {
      if (childrenReminder !== 0) {
        targetIndex = 0;
      } else {
        targetIndex = index - this.state.childrenCount;
      }
    } else if (childrenReminder !== 0 && index === (this.state.childrenCount - childrenReminder)) {
      targetIndex = index - (slidesToScroll - childrenReminder);
    } else {
      targetIndex = index;
    }

    return targetIndex;
  };

  handleTrack = (targetIndex, currentIndex) => {
    const settings = this.state.settings;
    const activePage = Math.ceil(currentIndex / settings.slidesToShow);
    const lazyLoadedList = this.getLazyLoadedIndexes(this.props.children, currentIndex);

    const callback = () => {
      setTimeout(() => {
        this.setState({
          currentIndex,
          animating: false,
          dragging: false,
        });
      }, settings.animationDuration);
    };

    const stopAnimation = () => {
      setTimeout(() => {
        this.setState({
          animating: false,
          dragging: false,
        });
      }, settings.animationDuration);
    };

    if (targetIndex < 0) {
      this.setState({
        currentIndex: targetIndex,
        activePage,
        animating: true,
        lazyLoadedList,
        touchObject: {
          startX: 0,
          startY: 0,
          endX: 0,
          endY: 0,
          length: 0,
          direction: -1,
        },
      }, callback);
    } else if (targetIndex >= this.props.children.length) {
      this.setState({
        currentIndex: targetIndex,
        activePage,
        animating: true,
        lazyLoadedList,
        touchObject: {
          startX: 0,
          startY: 0,
          endX: 0,
          endY: 0,
          length: 0,
          direction: -1,
        },
      }, callback);
    } else {
      this.setState({
        currentIndex,
        activePage,
        animating: true,
        lazyLoadedList,
        dragging: false,
        touchObject: {
          startX: 0,
          startY: 0,
          endX: 0,
          endY: 0,
          length: 0,
          direction: -1,
        },
      }, stopAnimation);
    }
  };

  moveToNext = (event) => {
    event.preventDefault();
    if (this.state.animating) {
      return;
    }
    const settings = this.state.settings;
    const targetIndex = this.state.currentIndex + settings.slidesToScroll;
    const currentIndex = this.getTargetIndex(targetIndex, settings.slidesToScroll);
    this.handleTrack(targetIndex, currentIndex);
  };

  moveToPrevious = (event) => {
    event.preventDefault();
    if (this.state.animating) {
      return;
    }
    const settings = this.state.settings;
    let targetIndex = this.state.currentIndex - settings.slidesToScroll;
    const currentIndex = this.getTargetIndex(targetIndex, settings.slidesToScroll);
    if (targetIndex < 0 && this.state.currentIndex !== 0) {
      targetIndex = 0;
    }
    this.handleTrack(targetIndex, currentIndex);
  };

  onDotClick = (event) => {
    event.preventDefault();
    if (this.state.animating) {
      return;
    }
    const settings = this.state.settings;
    const slidesToShow = settings.slidesToShow;
    const targetIndex = event.target.parentElement.getAttribute('data-index');
    const currentIndex = this.getTargetIndex(targetIndex * slidesToShow, slidesToShow);
    this.handleTrack(targetIndex * slidesToShow, currentIndex);
  };

  onWindowResized = () => {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(this.setDimensions, 100);
  };

  autoCycle = () => {
    const settings = this.state.settings;
    const targetIndex = this.state.currentIndex + settings.slidesToScroll;
    const currentIndex = this.getTargetIndex(targetIndex, settings.slidesToScroll);
    this.handleTrack(targetIndex, currentIndex);
  };

  playAutoCycle = () => {
    if (this.state.settings.autoCycle) {
      const autoCycleTimer = setInterval(this.autoCycle, this.state.settings.cycleInterval);
      this.setState({
        autoCycleTimer,
      });
    }
  };

  pauseAutoCycle = () => {
    if (this.state.autoCycleTimer) {
      clearInterval(this.state.autoCycleTimer);
      this.setState({
        autoCycleTimer: null,
      });
    }
  };

  onMouseEnter = () => {
    if (this.state.settings.autoCycle && this.state.settings.pauseOnHover) {
      this.pauseAutoCycle();
    }
  };

  onMouseOver = () => {
    if (this.state.settings.autoCycle && this.state.settings.pauseOnHover) {
      this.pauseAutoCycle();
    }
  };

  onMouseLeave = () => {
    if (this.state.settings.autoCycle && this.state.settings.pauseOnHover) {
      this.playAutoCycle();
    }
  };

  onSwipeStart = (e) => {
    if ((this.state.settings.swipe === false) || ('ontouchend' in document && this.state.settings.swipe === false)) {
      return;
    } else if (this.state.settings.draggable === false && e.type.indexOf('mouse') !== -1) {
      return;
    }

    const startX = (e.touches !== undefined) ? e.touches[0].pageX : e.clientX;
    const startY = (e.touches !== undefined) ? e.touches[0].pageY : e.clientY;

    this.setState({
      dragging: true,
      touchObject: {
        startX,
        startY,
      },
    });
  };

  onSwipeMove = (e) => {
    if (!this.state.dragging) {
      e.preventDefault();
      return;
    }
    if (this.state.animating) {
      return;
    }
    const curX = (e.touches !== undefined) ? e.touches[0].pageX : e.clientX;
    const curY = (e.touches !== undefined) ? e.touches[0].pageY : e.clientY;
    const touchObject = this.state.touchObject;
    const direction = getSwipeDirection(touchObject.startX, curX, touchObject.startY, curY);

    if (direction !== 0) {
      e.preventDefault();
    }

    const swipeLength = Math.round(Math.sqrt((curX - touchObject.startX) ** 2));

    this.setState({
      touchObject: {
        startX: touchObject.startX,
        startY: touchObject.startY,
        endX: curX,
        endY: curY,
        length: swipeLength,
        direction,
      },
    });
  };

  onSwipeEnd = () => {
    const swipeLength = this.state.touchObject.length;
    if (swipeLength !== 0 && swipeLength > this.state.slidesWidth / 2) {
      if (this.state.touchObject.direction === 1) {
        // Next
        const settings = this.state.settings;
        const targetIndex = this.state.currentIndex + settings.slidesToScroll;
        const currentIndex = this.getTargetIndex(targetIndex, settings.slidesToScroll);
        this.handleTrack(targetIndex, currentIndex);
      } else {
        // Previous
        const settings = this.state.settings;
        let targetIndex = this.state.currentIndex - settings.slidesToScroll;
        const currentIndex = this.getTargetIndex(targetIndex, settings.slidesToScroll);
        if (targetIndex < 0 && this.state.currentIndex !== 0) {
          targetIndex = 0;
        }
        this.handleTrack(targetIndex, currentIndex);
      }
    }
  };

  getTrackStyles = () => {
    const settings = this.state.settings;
    const touchObject = this.state.touchObject;

    let trackWidth = (this.state.slidesWidth + (settings.slidesSpacing * 2));
    trackWidth *= (this.state.slidesCount + (settings.slidesToShow * 2));
    const totalSlideWidth = this.state.slidesWidth + (settings.slidesSpacing * 2);
    const initialTrackPostion = totalSlideWidth * this.props.slidesToShow;
    const transition = this.state.animating ? `transform ${settings.animationDuration}ms ease` : '';
    const hasTouchOffset = settings.swipe && touchObject.length;
    const touchOffset = hasTouchOffset ? touchObject.length * touchObject.direction : 0;
    const slidePosition = totalSlideWidth * this.state.currentIndex;
    const trackPosition = initialTrackPostion + slidePosition + touchOffset;

    return {
      position: 'relative',
      display: 'block',
      width: trackWidth,
      height: 'auto',
      padding: 0,
      transition,
      transform: `translate(${-trackPosition}px, 0px)`,
      boxSizing: 'border-box',
      MozBoxSizing: 'border-box',
    };
  };

  getScrollTrackStyles = () => {
    return {
      clear: 'both',
      position: 'relative',
      display: 'block',
      width: '100%',
      height: 'auto',
      padding: 0,
      boxSizing: 'border-box',
      MozBoxSizing: 'border-box',
    };
  };

  getSlideStyles = () => {
    const slidesWidth = this.state.slidesWidth;

    return {
      position: 'relative',
      //float: 'left',
      display: 'inline-block',
      width: slidesWidth,
      height: 'auto',
      margin: `0 ${this.state.settings.slidesSpacing}px`,
    };
  };

  getFormatedChildren = (children, lazyLoadedList) => {
    return React.Children.map(children, (child, index) => {
      if (!this.state.settings.lazyLoad || lazyLoadedList.indexOf(index) >= 0) {
        return (
          <li
            className={styles.InfiniteCarouselSlide}
            key={index}
            style={this.getSlideStyles()}
          >
            {child}
          </li>
        );
      } else {
        return (
          <li
            className={styles.InfiniteCarouselSlide}
            key={index}
            style={this.getSlideStyles()}
          >
            <img src={this.state.settings.placeholderImageSrc} />
          </li>
        );
      }
    });
  };

  init = () => {
    const isTouchDevicex = isTouchDevice();
    let children;
    let settings;

    if (isTouchDevicex) {
      settings = Object.assign({}, this.defaultProps, this.props, this.state.scrollOnDeviceProps);
      children = !Array.isArray(this.props.children) ? [this.props.children] : this.props.children;
    } else {
      settings = Object.assign({}, this.defaultProps, this.props);
      children = this.getChildrenList(this.props.children, this.props.slidesToShow);
    }
    
    this.setState({
      children,
      settings,
      isTouchDevicex,
    });

    if (this.props.responsive) {
      this.setupBreakpointSettings(this.props.breakpoints);
    }
  };

  render() {
    let prevArrow;
    let nextArrow;
    let dots;

    if (this.state.settings.arrows) {
      if (this.state.settings.prevArrow == null) {
        prevArrow = (
          <InfiniteCarouselArrow
            next={false}
            onClick={this.moveToPrevious}
            styles={styles}
          />
        );
      } else {
        const prevArrowProps = {
          onClick: this.moveToPrevious,
        };
        prevArrow = React.cloneElement(this.state.settings.prevArrow, prevArrowProps);
      }

      if (this.state.settings.nextArrow == null) {
        nextArrow = (
          <InfiniteCarouselArrow
            onClick={this.moveToNext}
            styles={styles}
          />
        );
      } else {
        const nextArrowProps = {
          onClick: this.moveToNext,
        };
        nextArrow = React.cloneElement(this.state.settings.nextArrow, nextArrowProps);
      }
    }

    if (this.state.settings.dots) {
      dots = (
        <InfiniteCarouselDots
          activePage={this.state.activePage}
          numberOfDots={this.state.slidePages}
          onClick={this.onDotClick}
          styles={styles}
        />
      );
    }

    const children = this.getFormatedChildren(this.state.children, this.state.lazyLoadedList);
    let trackStyles, trackClassName, frameClassName;

    if (this.props.scrollOnDevice && isTouchDevice()) {
      trackStyles = this.getScrollTrackStyles();
      trackClassName = styles.InfiniteCarouselScrollTrack;
    } else {
      trackStyles = this.getTrackStyles();
      trackClassName = '';
    }

    const disableSwipeEvents = this.props.scrollOnDevice && isTouchDevice();
    

    return (
      <div
        className={styles.InfiniteCarousel}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
        onMouseOver={this.onMouseOver}
      >
        {prevArrow}
        <div
          className={styles.InfiniteCarouselFrame}
          ref='frame'
        >
          <ul
            className={trackClassName}
            ref='track'
            style={trackStyles}
            
          >
            {children}
          </ul>
        </div>
        {nextArrow}
        {dots}
      </div>
    );
  }
}

export default InfiniteCarousel;
