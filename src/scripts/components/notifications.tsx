import * as React from "react";
import { randomID } from "../utilities";

export enum NotificationLevel {
    INFO,
    WARNING,
    ERROR,
}

export interface Notification {
    id: string;
    level: NotificationLevel;
    text: string;
    expiration: Date;
}


export interface ToastProps {
    id: string;
    className?: string;
}
export interface ToastState { }

export class Toast extends React.Component<ToastProps, ToastState> {
    constructor(props: ToastProps) {
        super(props);
        this.state = {};
    }

    render() {
        return (
            <div id={this.props.id} className={`${this.props.className} notification`}>
                {this.props.children}
            </div>
        );
    }

    componentDidMount() {
        const element = $(document.getElementById(this.props.id));
        element.fadeIn(200);
        const promise = new Promise(resolve => { setTimeout(resolve, 2000) });
        promise.then(() => {
            element.fadeOut(700);
        });
    }
}

export interface NotificationBarProps { }
export interface NotificationBarState {
    notifications: Notification[];
}

export class NotificationBar extends React.Component<NotificationBarProps, NotificationBarState> {
    intervalHandle: any;

    constructor(props: NotificationBarProps) {
        super(props);
        this.state = {
            notifications: [],
        };
        this.intervalHandle = null;
        window.notifications = this;
    }

    send(level: NotificationLevel, text: string) {
        if (level === NotificationLevel.INFO) {
            console.log(text);
        }
        else if (level === NotificationLevel.WARNING) {
            console.warn(text);
        }
        else {
            console.error(text);
        }
        const expiration = new Date();
        expiration.setMilliseconds(
            expiration.getMilliseconds()
            + 200 // FadeIn duration
            + 2000 // View duration
            + 700 // FadeOut duration
            + 1000 // Buffer
        );
        this.setState({
            notifications: [...this.state.notifications, {
                id: randomID(), level, text, expiration
            }],
        });

        if (this.intervalHandle === null) {
            this.intervalHandle = setInterval(() => {
                const now = new Date();
                const notifications = [...this.state.notifications];
                let change = false;
                while (notifications.length > 0 && now > notifications[0].expiration) {
                    notifications.shift();
                    change = true;
                }
                if (change) {
                    this.setState({ notifications });
                }
                if (notifications.length === 0) {
                    clearInterval(this.intervalHandle);
                    this.intervalHandle = null;
                    return;
                }
            }, 1000);
        }
    }

    info(text: string) {
        this.send(NotificationLevel.INFO, text);
    }

    warning(text: string) {
        this.send(NotificationLevel.WARNING, text);
    }

    error(text: string) {
        this.send(NotificationLevel.ERROR, text);
    }

    render() {
        const notifications = [];
        for (let notification of this.state.notifications) {
            if (notification.level === NotificationLevel.ERROR) {
                notifications.push(
                    <Toast key={notification.id} id={notification.id} className="error">
                        <i className="fas fa-times-circle"></i>
                        {notification.text}
                    </Toast>
                );
            }
            else if (notification.level === NotificationLevel.WARNING) {
                notifications.push(
                    <Toast key={notification.id} id={notification.id} className="warning">
                        <i className="fas fa-exclamation-triangle"></i>
                        {notification.text}
                    </Toast>
                );
            }
            else {
                notifications.push(
                    <Toast key={notification.id} id={notification.id} className="info">
                        <i className="fas fa-info-circle"></i>
                        {notification.text}
                    </Toast>
                );
            }
        }
        return (
            <div id="notifications">
                {notifications}
            </div>
        );
    }

    componentWillUnmount() {
        if (this.intervalHandle !== null) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
    }
}
