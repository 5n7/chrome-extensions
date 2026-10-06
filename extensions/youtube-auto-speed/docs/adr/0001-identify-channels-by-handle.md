# Identify channels by handle

A Channel Rule names its channel by handle (`@name`, compared ignoring case), not by display name or channel ID. Display names are not unique and change without notice, which silently breaks a rule; channel IDs never change, but nobody can type one from memory or recognize one in a list of rules. A handle is unique, rarely changes, shows in every channel URL, and can be typed or pasted in the options page, so it is the one identifier both the popup and the options page can produce. The display name is kept beside the handle for showing only.
